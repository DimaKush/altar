// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {Superbles} from "../contracts/Superbles.sol";

contract BridgeBaseToZoraScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // Read addresses from broadcast files
        string memory superblesJson = vm.readFile("broadcast/SuperblesAddresses.json");
        address superblesOpAddress = vm.parseJsonAddress(superblesJson, "$.optimism");
        address superblesBaseAddress = vm.parseJsonAddress(superblesJson, "$.base");
        address superblesZoraAddress = vm.parseJsonAddress(superblesJson, "$.zora");
        // Bridge tokens from Base to Zora
        vm.createSelectFork("http://127.0.0.1:9546");
        console.log("ChainId on Base:", block.chainid);
        vm.roll(block.number + 10); // simulate relay delay
        uint256 baseBalance = Superbles(superblesBaseAddress).balanceOf(msg.sender);
        require(baseBalance >= 0.1 ether, "Not enough Superbles on Base for bridging");
        vm.startBroadcast(deployerPrivateKey);
        Superbles(superblesBaseAddress).approve(0x4200000000000000000000000000000000000028, 0.2 ether);
        (bool success,) = 0x4200000000000000000000000000000000000028.call(
            abi.encodeWithSignature("sendERC20(address,address,uint256,uint256)", 
                superblesBaseAddress, // token
                msg.sender, // to
                0.1 ether, // amount
                7777777 // chainId for Zora
            )
        );
        require(success, "sendERC20 Base->Zora failed");
        console2.log("Bridged 0.1 tokens from Base to Zora");
        vm.stopBroadcast();
    }
} 