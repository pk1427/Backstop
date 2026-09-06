// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

contract ForkSetupTest is Test {
    address constant AQUA_REGISTRY = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;

    function testForkAquaRegistryCodeSize() public {
        vm.chainId(1);
        uint256 codeSize = AQUA_REGISTRY.code.length;
        assertTrue(codeSize > 0, "Aqua registry has no code");
    }
}
