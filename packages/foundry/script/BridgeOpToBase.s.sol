// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {Superbles} from "../contracts/Superbles.sol";

contract BridgeOpToBaseScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // Read addresses from broadcast files
        string memory superblesJson = vm.readFile("broadcast/SuperblesAddresses.json");
        address superblesOpAddress = vm.parseJsonAddress(superblesJson, "$.optimism");
        address superblesBaseAddress = vm.parseJsonAddress(superblesJson, "$.base");
        // Bridge tokens from Optimism to Base
        vm.createSelectFork("http://127.0.0.1:9545");
        console.log("ChainId on Optimism:", block.chainid);
        uint256 opBalance = Superbles(superblesOpAddress).balanceOf(msg.sender);
        require(opBalance >= 0.2 ether, "Not enough Superbles on OP for bridging");
        vm.startBroadcast(deployerPrivateKey);
        Superbles(superblesOpAddress).approve(0x4200000000000000000000000000000000000028, 0.3 ether);
        (bool success,) = 0x4200000000000000000000000000000000000028.call(
            abi.encodeWithSignature("sendERC20(address,address,uint256,uint256)", 
                superblesOpAddress, // token
                msg.sender, // to
                0.2 ether, // amount
                8453 // chainId for Base
            )
        );
        require(success, "sendERC20 OP->Base failed");
        console2.log("Bridged 0.2 tokens from Optimism to Base");
        vm.stopBroadcast();
    }
} 