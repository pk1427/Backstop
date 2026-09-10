import {
	cre,
	hexToBase64,
	ok,
	text,
	type TeeRuntime,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters, parseAbiParameters, keccak256, toHex } from 'viem'
import { z } from 'zod'

// ─── Config Schema ──────────────────────────────────────────
export const configSchema = z.object({
	schedule: z.string(),
	url: z.string(),
	secretId: z.string(),
	scoreThreshold: z.number(),
	receiverAddress: z.string(),
	chainSelector: z.string(),
	gasLimit: z.number(),
})
type Config = z.infer<typeof configSchema>

// ─── Quote type (ABI-encoded and delivered onchain) ─────────
type Quote = {
	quoteId: string
	price: bigint
	size: bigint
	// Raw collateral-token units; WETH uses 18 decimals.
	minCollateralOut: bigint
	expiry: bigint
	execute: boolean
}

// ─── Private discount curve ─────────────────────────────────
// These parameters are fetched from CRE secrets inside the TEE.
// They must NEVER appear in logs, workflow source constants, or onchain state.
type PrivateCurve = {
	minDiscountBps: number
	maxDiscountBps: number
	riskAppetite: number
}

const loadPrivateCurve = (secretsJson: string): PrivateCurve => {
	let parsed: Record<string, string>
	try {
		parsed = JSON.parse(secretsJson) as Record<string, string>
	} catch {
		// If the secret is a plain string (e.g., simulation placeholder), use defaults
		parsed = { MIN_DISCOUNT_BPS: '100', MAX_DISCOUNT_BPS: '500', RISK_APPETITE: '0.5' }
	}

	const minDiscountBps = Number(parsed['MIN_DISCOUNT_BPS'])
	const maxDiscountBps = Number(parsed['MAX_DISCOUNT_BPS'])
	const riskAppetite = Number(parsed['RISK_APPETITE'])

	if (!Number.isFinite(minDiscountBps) || !Number.isFinite(maxDiscountBps) || !Number.isFinite(riskAppetite)) {
		throw new Error('Invalid private curve secrets')
	}

	return { minDiscountBps, maxDiscountBps, riskAppetite }
}

// Deterministic linear interpolation: healthier asset → tighter discount,
// more distressed asset → wider discount. riskAppetite scales the slope.
const computeDiscountBps = (healthFactor: number, curve: PrivateCurve): number => {
	const clampedHealth = Math.max(0, Math.min(1, healthFactor))
	const slope = (curve.maxDiscountBps - curve.minDiscountBps) * curve.riskAppetite
	const discount = curve.minDiscountBps + slope * (1 - clampedHealth)
	return Math.floor(discount)
}

// ─── TEE Cron Callback ──────────────────────────────────────
export const onCronTrigger = (runtime: TeeRuntime<Config>): string => {
	const config = runtime.config

	// ── Step 1: Fetch private maker curve inside the enclave ──
	// The Vault DON releases these secrets only into an attested enclave.
	const secretsJson = runtime.getSecret({ id: config.secretId }).result().value
	const curve = loadPrivateCurve(secretsJson)

	let apiToken = ''
	try {
		const parsed = JSON.parse(secretsJson) as Record<string, string>
		apiToken = parsed['API_TOKEN'] ?? ''
	} catch {
		// Plain string secret - use it directly as the token
		apiToken = secretsJson
	}

	// ── Step 2: Fetch public liquidation inputs ──
	// In production, these come from an authenticated API or onchain read.
	// For this phase, we use the configured HTTP endpoint.
	const response = new cre.capabilities.HTTPClient()
		.sendRequest(runtime, {
			url: config.url,
			method: 'GET',
		multiHeaders: {
			Authorization: { values: [`Bearer ${apiToken}`] },
		},
		})
		.result()

	if (!ok(response)) {
		throw new Error(`Confidential request failed with status: ${response.statusCode}`)
	}

	const body = text(response)

	// ── Step 3: Deterministic quote calculation inside TEE ──
	// Public inputs parsed from the authenticated response.
	const healthFactor = 0.75 // placeholder parsing from body
	const collateralPrice = 1_000_000_000n // placeholder parsing from body
	const requestedSize = 1_000_000_000_000_000_000n // placeholder parsing from body
	// Simulated only: production must derive this from authenticated prices, the
	// maker discount, and token decimals before encoding the quote.
	const minCollateralOut = 250_000_000_000_000_000n

	// Private curve influences the quote price. The curve itself stays confidential.
	const discountBps = computeDiscountBps(healthFactor, curve)

	// Enforce strategy-level bounds inside the workflow so the quote is always
	// compatible with the onchain immutable strategy.
	const minDiscountBps = 100
	const maxDiscountBps = 500
	const boundedDiscount = Math.max(minDiscountBps, Math.min(maxDiscountBps, discountBps))

	// Build the application payload.
	const quoteId = keccak256(toHex(encodeAbiParameters(parseAbiParameters('uint256 timestamp, uint256 size, uint256 discount'), [BigInt(Math.floor(Date.now() / 1000)), requestedSize, BigInt(boundedDiscount)])))
	const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600)

	const quote: Quote = {
		quoteId,
		price: BigInt(boundedDiscount),
		size: requestedSize,
		minCollateralOut,
		expiry,
		execute: true,
	}

	const encodedPayload = encodeAbiParameters(
		parseAbiParameters('bytes32, uint256, uint256, uint256, uint64, bool'),
		[quote.quoteId as `0x${string}`, quote.price, quote.size, quote.minCollateralOut, quote.expiry, quote.execute],
	)

	// ── Step 4: Cross back to the DON and generate a signed report ──
	const donRuntime = runtime.usingTheDons()

	const report = donRuntime
		.report({
			encodedPayload: hexToBase64(encodedPayload),
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
		.result()

	// ── Step 5: Deliver the signed report onchain ──
	if (config.receiverAddress && config.chainSelector && config.gasLimit) {
		const evmClient = new cre.capabilities.EVMClient(BigInt(config.chainSelector))

		try {
			const writeResult = evmClient
				.writeReport(donRuntime, {
					receiver: config.receiverAddress,
					report,
					gasConfig: { gasLimit: BigInt(config.gasLimit) },
				} as any)
				.result()

			runtime.log(`Report delivered: txStatus=${writeResult.txStatus}`)
		} catch (e: any) {
			runtime.log(`writeReport error: ${e.message}`)
			throw e
		}
	}

	return `Quote generated: discount=${boundedDiscount} bps`
}

// ─── Workflow Init ──────────────────────────────────────────
export function initWorkflow(config: Config) {
	const cronTrigger = new cre.capabilities.CronCapability()

	return [
		cre.handlerInTee(cronTrigger.trigger({ schedule: config.schedule }), onCronTrigger, [
			{ tee: 'nitro', regions: ['us-west-2'] },
		]),
	]
}
