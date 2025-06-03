// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {Superbles} from "../contracts/Superbles.sol";
import {ICreateX} from "../lib/createx/src/ICreateX.sol";


contract DeploySuperblesScript is Script {

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Read Bles token address from broadcast file
        string memory blesJson = vm.readFile("broadcast/BlesTokenAddress.json");
        address blesTokenAddress = vm.parseJsonAddress(blesJson, "$.blesToken");

        bytes32 salt = hex"f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000";

        // Get Superbles bytecode
        bytes memory bytecode = vm.getCode("out/Superbles.sol/Superbles.json");

        // Encode constructor args
        bytes memory constructorArgs = abi.encode(
            0x4200000000000000000000000000000000000010,
            blesTokenAddress
        );

        bytes memory initCode = bytes.concat(bytecode, constructorArgs);

        // Deploy on Optimism
        vm.createSelectFork("http://127.0.0.1:9545");
        vm.startBroadcast(deployerPrivateKey);
        ICreateX createX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);
        address superblesOp = createX.deployCreate2(salt, initCode);
        console2.log("Superbles on Optimism (CreateX):", superblesOp);
        // vm.makePersistent(superblesOp);
        vm.stopBroadcast();

        // Deploy on Base
        vm.createSelectFork("http://127.0.0.1:9546");
        vm.startBroadcast(deployerPrivateKey);
        address superblesBase = createX.deployCreate2(salt, initCode);
        console2.log("Superbles on Base (CreateX):", superblesBase);
        // vm.makePersistent(superblesBase);
        vm.stopBroadcast();

        // Deploy on Zora
        vm.createSelectFork("http://127.0.0.1:9547");
        vm.startBroadcast(deployerPrivateKey);
        address superblesZora = createX.deployCreate2(salt, initCode);
        console2.log("Superbles on Zora (CreateX):", superblesZora);
        // vm.makePersistent(superblesZora);
        vm.stopBroadcast();

        string memory outPath = "broadcast/SuperblesAddresses.json";
        string memory superblesJson = string(
            abi.encodePacked(
                '{"optimism":"', vm.toString(superblesOp), '",',
                '"base":"', vm.toString(superblesBase), '",',
                '"zora":"', vm.toString(superblesZora), '"}'
            )
        );
        vm.writeFile(outPath, superblesJson);
    }
} 