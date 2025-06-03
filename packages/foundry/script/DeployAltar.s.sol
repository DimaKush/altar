// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import "../contracts/Altar.sol";
import "./DeployHelpers.s.sol";

contract DeployAltar is ScaffoldETHDeploy {
    // sepolia
    // address public constant daoMultisig =
    //     0x0D4495a88ACF226033bB9356155a7262603f4843;
    // address public constant factory =
    //     0xF62c03E08ada871A0bEb309762E260a7a6a880E6;
    // address public constant router = 0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3;
    // address public constant lockupLinear =
    //     0x3E435560fd0a03ddF70694b35b673C25c65aBB6C;
    // address public constant weth = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;

    // mainnet
    address public constant daoMultisig =
        0x0D4495a88ACF226033bB9356155a7262603f4843;
    address public constant factory =
        0xF62c03E08ada871A0bEb309762E260a7a6a880E6;
    address public constant router = 0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3;
    address public constant lockupLinear =
        0x3E435560fd0a03ddF70694b35b673C25c65aBB6C;
    address public constant weth = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;

    function run() public ScaffoldEthDeployerRunner {
        Altar altar = new Altar(
            daoMultisig,
            factory,
            router,
            lockupLinear,
            weth
        );
        console.log("Altar deployed at:", address(altar));
        console.log("Bles token at:", altar.blesedToBles(msg.sender));
    }
}
