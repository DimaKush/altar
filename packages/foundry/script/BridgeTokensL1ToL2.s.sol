// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {Superbles} from "../contracts/Superbles.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Altar} from "../contracts/Altar.sol";

contract BridgeTokensL1ToL2Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // Read addresses from broadcast files
        string memory l1BroadcastPath = "broadcast/DeployAltar.s.sol/1/run-latest.json";
        string memory l1Json = vm.readFile(l1BroadcastPath);
        address altarAddress = vm.parseJsonAddress(l1Json, "$.transactions[0].contractAddress");

        string memory superblesJson = vm.readFile("broadcast/SuperblesAddresses.json");
        address superblesOpAddress = vm.parseJsonAddress(superblesJson, "$.optimism");
        address superblesBaseAddress = vm.parseJsonAddress(superblesJson, "$.base");
        address superblesZoraAddress = vm.parseJsonAddress(superblesJson, "$.zora");
        // Create L1 fork once and reuse it
        uint256 l1Fork = vm.createSelectFork("http://127.0.0.1:8545");
        // Get tokens on L1
        vm.startBroadcast(deployerPrivateKey);
        string memory blesJson = vm.readFile("broadcast/BlesTokenAddress.json");
        address blesTokenAddress = vm.parseJsonAddress(blesJson, "$.blesToken");
        console2.log("Got tokens on L1, token address:", blesTokenAddress);
        vm.stopBroadcast();
        // Bridge tokens from L1 to Optimism
        vm.selectFork(l1Fork);
        vm.startBroadcast(deployerPrivateKey);
        IERC20(blesTokenAddress).approve(0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1, 1 ether);
        (bool success,) = 0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1.call(
            abi.encodeWithSignature("depositERC20(address,address,uint256,uint32,bytes)", 
                blesTokenAddress, // L1 token
                superblesOpAddress, // L2 token
                0.3 ether, // amount
                50000, // min gas limit
                "" // extra data
            )
        );
        require(success, "depositERC20 failed");
        console2.log("Bridged 0.3 tokens from L1 to Optimism");
        vm.stopBroadcast();
    }
} 