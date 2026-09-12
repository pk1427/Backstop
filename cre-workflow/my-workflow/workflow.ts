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
	// Optional controlled-market inputs. When present, CRE reads the mock pool
	// directly over JSON-RPC instead of using the starter HTTP placeholder.
	rpcUrl: z.string().optional().default(''),
	mockPoolAddress: z.string().optional().default(''),
	mockOracleAddress: z.string().optional().default(''),
	mockWethAddress: z.string().optional().default(''),
	mockBorrowerAddress: z.string().optional().default(''),
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

const rpcCall = (runtime: TeeRuntime<Config>, rpcUrl: string, to: string, data: string): bigint => {
	const response = new cre.capabilities.HTTPClient().sendRequest(runtime, {
		url: rpcUrl,
		method: 'POST',
		multiHeaders: {'Content-Type': {values: ['application/json']}},
		body: new TextEncoder().encode(JSON.stringify({jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{to, data}, 'latest']})),
	}).result()
	if (!ok(response)) throw new Error(`Mock market RPC request failed with status: ${response.statusCode}`)
	const result = JSON.parse(text(response)) as {result?: string; error?: {message?: string}}
	if (!result.result) throw new Error(`Mock market RPC error: ${result.error?.message ?? 'missing result'}`)
	return BigInt(result.result)
}

const controlledMarketConfigured = (config: Config) =>
	Boolean(config.rpcUrl && config.mockPoolAddress && config.mockOracleAddress && config.mockWethAddress && config.mockBorrowerAddress)

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
	// Controlled staging path: read HF and price from the dedicated mock market.
	// A healthy position intentionally produces no execution quote.
	if (controlledMarketConfigured(config)) {
		const borrower = config.mockBorrowerAddress.replace(/^0x/, '').padStart(64, '0')
		const hfRaw = rpcCall(runtime, config.rpcUrl, config.mockPoolAddress, `0x6ad9f9df${borrower}`)
		const healthFactor = Number(hfRaw) / 1e18
		if (hfRaw >= 1_000_000_000_000_000_000n) return `No quote: controlled position healthy (HF ${healthFactor.toFixed(4)})`

		const asset = config.mockWethAddress.replace(/^0x/, '').padStart(64, '0')
		const collateralPrice = rpcCall(runtime, config.rpcUrl, config.mockOracleAddress, `0xb3596f07${asset}`)
		const requestedSize = 500_000_000n
		const minCollateralOut = (requestedSize * 100n * 10_500n * 10n ** 18n) / (collateralPrice * 10_000n)
		const discountBps = computeDiscountBps(healthFactor, curve)
		const boundedDiscount = Math.max(100, Math.min(500, discountBps))
		const quoteId = keccak256(toHex(encodeAbiParameters(parseAbiParameters('uint256 timestamp, address borrower, uint256 price'), [BigInt(Math.floor(Date.now() / 1000)), config.mockBorrowerAddress as `0x${string}`, collateralPrice])))
		const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600)
		const encodedPayload = encodeAbiParameters(parseAbiParameters('bytes32, uint256, uint256, uint256, uint64, bool'), [quoteId as `0x${string}`, BigInt(boundedDiscount), requestedSize, minCollateralOut, expiry, true])
		const donRuntime = runtime.usingTheDons()
		const report = donRuntime.report({encodedPayload: hexToBase64(encodedPayload), encoderName: 'evm', signingAlgo: 'ecdsa', hashingAlgo: 'keccak256'}).result()
		const evmClient = new cre.capabilities.EVMClient(BigInt(config.chainSelector))
		evmClient.writeReport(donRuntime, {receiver: config.receiverAddress, report, gasConfig: {gasLimit: BigInt(config.gasLimit)}} as any).result()
		return `Controlled quote generated: HF ${healthFactor.toFixed(4)}, discount=${boundedDiscount} bps`
	}

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
	// USDC is the backstop's output asset and has 6 decimals on Sepolia.
	// Keep this quote within the shipped 500-USDC strategy limit.
	const requestedSize = 500_000_000n
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
			evmClient
				.writeReport(donRuntime, {
					receiver: config.receiverAddress,
					report,
					gasConfig: { gasLimit: BigInt(config.gasLimit) },
				} as any)
				.result()
		} catch {
			// Do not log from inside the enclave: even operational logs can reveal
			// timing or workflow behaviour. The DON reports delivery failures.
			throw new Error('CRE report delivery failed')
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
