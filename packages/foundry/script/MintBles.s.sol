// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {Altar} from "../contracts/Altar.sol";

contract MintBlesScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory l1BroadcastPath = "broadcast/DeployAltar.s.sol/1/run-latest.json";
        string memory l1Json = vm.readFile(l1BroadcastPath);
        address altarAddress = vm.parseJsonAddress(l1Json, "$.transactions[0].contractAddress");
        vm.startBroadcast(deployerPrivateKey);
        address blesTokenAddress = Altar(altarAddress).blesedToBles(msg.sender);
        if (blesTokenAddress == address(0)) {
            Altar(altarAddress).spark{value: 3.2 ether}(0, address(0));
            blesTokenAddress = Altar(altarAddress).blesedToBles(msg.sender);
            console2.log("Minted Bles token for:", msg.sender);
        } else {
            console2.log("Bles token already exists for:", msg.sender);
        }
        console2.log("Bles token address:", blesTokenAddress);
        string memory outPath = "broadcast/BlesTokenAddress.json";
        string memory blesJson = string(abi.encodePacked('{"blesToken":"', vm.toString(blesTokenAddress), '"}'));
        vm.writeFile(outPath, blesJson);
        vm.stopBroadcast();
    }
} 