// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {Altar} from "../contracts/Altar.sol";

contract callSpark is Script {
    function run(
        address altarAddress,
        uint256 division,
        uint256 amount,
        address referral
    ) external {
        vm.startBroadcast();
        Altar(altarAddress).spark{value: amount}(division, referral);
        vm.stopBroadcast();
    }
}
