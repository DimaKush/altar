// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface IAltar {
    function spark(uint division) external payable returns (address, address, uint);
    function blesedToBles(address blesed) external view returns (address);
    function blesToBlesed(address blesToken) external view returns (address);
    function refill(uint amount) external;
} 