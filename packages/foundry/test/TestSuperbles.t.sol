// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Superbles} from "../contracts/Superbles.sol";
import {Altar, Bles} from "../contracts/Altar.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestSuperblesTest is Test {
    // Supersim predeploy addresses
    address constant SUPERCHAIN_TOKEN_BRIDGE = 0x4200000000000000000000000000000000000028;
    address constant L1_STANDARD_BRIDGE = 0x4200000000000000000000000000000000000010;
    
    // Test addresses
    address constant TEST_USER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address constant TEST_USER2 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant DAO_MULTISIG = 0x702CFd2e92ECA7a75Cd2EB35A9052252374ef02A;

    // Real contract addresses on forked networks
    address constant UNISWAP_V2_FACTORY = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address constant UNISWAP_V2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address constant SABLIER_LOCKUP = 0xAFb979d9afAd1aD27C5eFf4E27226E3AB9e5dCC9;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    // Contract addresses for each chain
    address public altarAddress;
    address public blesTokenAddress;
    address public superblesOpAddress;
    address public superblesBaseAddress;
    address public superblesZoraAddress;

    // Fork IDs
    uint256 l1Fork;
    uint256 optimismFork;
    uint256 baseFork;
    uint256 zoraFork;

    function setUp() public {
        // Create forks with correct chain IDs and block numbers
        l1Fork = vm.createFork("http://127.0.0.1:8545", 1); // mainnet
        optimismFork = vm.createFork("http://127.0.0.1:9545", 10); // optimism
        baseFork = vm.createFork("http://127.0.0.1:9546", 8453); // base
        zoraFork = vm.createFork("http://127.0.0.1:9547", 7777777); // zora

        // Deploy Altar on L1
        vm.selectFork(l1Fork);
        vm.startPrank(TEST_USER);
        Altar altar = new Altar(
            DAO_MULTISIG,
            UNISWAP_V2_FACTORY,
            UNISWAP_V2_ROUTER,
            SABLIER_LOCKUP,
            WETH
        );
        altarAddress = address(altar);

        // Call spark() with 1 ETH
        vm.deal(TEST_USER, 1 ether);
        (bool success,) = altarAddress.call{value: 1 ether}(
            abi.encodeWithSignature("spark(uint256,address)", 1, TEST_USER2)
        );
        require(success, "spark() failed");
        
        // Get Bles token address
        blesTokenAddress = altar.blesedToBles(TEST_USER);
        vm.stopPrank();

        // Deploy Superbles on each chain
        vm.selectFork(optimismFork);
        Superbles superblesOp = new Superbles(
            0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1, // L1StandardBridge for OP Mainnet
            blesTokenAddress // remote token is Bles from spark
        );
        superblesOpAddress = address(superblesOp);

        vm.selectFork(baseFork);
        Superbles superblesBase = new Superbles(
            0x3154Cf16ccdb4C6d922629664174b904d80F2C35, // L1StandardBridge for Base
            blesTokenAddress // remote token is Bles from spark
        );
        superblesBaseAddress = address(superblesBase);

        vm.selectFork(zoraFork);
        Superbles superblesZora = new Superbles(
            0x3e2Ea9B92B7E48A52296fD261dc26fd995284631, // L1StandardBridge for Zora
            blesTokenAddress // remote token is Bles from spark
        );
        superblesZoraAddress = address(superblesZora);
    }

    function testBridgeFromL1ToOptimism() public {
        // Bridge tokens from L1 to Optimism
        vm.selectFork(l1Fork);
        vm.startPrank(TEST_USER);
        IERC20(blesTokenAddress).approve(0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1, 1000 ether);
        (bool success,) = 0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1.call(
            abi.encodeWithSignature("depositERC20(address,address,uint256,uint32,bytes)", 
                blesTokenAddress, // L1 token
                superblesOpAddress, // L2 token
                1000 ether, // amount
                50000, // min gas limit
                "" // extra data
            )
        );
        require(success, "depositERC20 failed");
        vm.stopPrank();

        // Check balance on Optimism
        vm.selectFork(optimismFork);
        uint256 balance = Superbles(superblesOpAddress).balanceOf(TEST_USER);
        assertEq(balance, 1000 ether, "Incorrect balance on Optimism");
    }

    function testBridgeFromOptimismToBase() public {
        // First bridge from L1 to Optimism
        testBridgeFromL1ToOptimism();

        // Bridge tokens from Optimism to Base
        vm.selectFork(optimismFork);
        vm.startPrank(TEST_USER);
        Superbles(superblesOpAddress).approve(0x4200000000000000000000000000000000000010, 500 ether);
        (bool success,) = 0x4200000000000000000000000000000000000010.call(
            abi.encodeWithSignature("bridgeERC20(address,address,uint256,uint32,bytes)", 
                superblesOpAddress, // local token
                superblesBaseAddress, // remote token
                500 ether, // amount
                50000, // min gas limit
                "" // extra data
            )
        );
        require(success, "bridgeERC20 failed");
        vm.stopPrank();

        // Check balances
        vm.selectFork(optimismFork);
        uint256 opBalance = Superbles(superblesOpAddress).balanceOf(TEST_USER);
        assertEq(opBalance, 500 ether, "Incorrect balance on Optimism");

        vm.selectFork(baseFork);
        uint256 baseBalance = Superbles(superblesBaseAddress).balanceOf(TEST_USER);
        assertEq(baseBalance, 500 ether, "Incorrect balance on Base");
    }

    function testBridgeFromBaseToZora() public {
        // First bridge from L1 to Optimism to Base
        testBridgeFromOptimismToBase();

        // Bridge tokens from Base to Zora
        vm.selectFork(baseFork);
        vm.startPrank(TEST_USER);
        Superbles(superblesBaseAddress).approve(0x4200000000000000000000000000000000000010, 250 ether);
        (bool success,) = 0x4200000000000000000000000000000000000010.call(
            abi.encodeWithSignature("bridgeERC20(address,address,uint256,uint32,bytes)", 
                superblesBaseAddress, // local token
                superblesZoraAddress, // remote token
                250 ether, // amount
                50000, // min gas limit
                "" // extra data
            )
        );
        require(success, "bridgeERC20 failed");
        vm.stopPrank();

        // Check balances
        vm.selectFork(optimismFork);
        uint256 opBalance = Superbles(superblesOpAddress).balanceOf(TEST_USER);
        assertEq(opBalance, 500 ether, "Incorrect balance on Optimism");

        vm.selectFork(baseFork);
        uint256 baseBalance = Superbles(superblesBaseAddress).balanceOf(TEST_USER);
        assertEq(baseBalance, 250 ether, "Incorrect balance on Base");

        vm.selectFork(zoraFork);
        uint256 zoraBalance = Superbles(superblesZoraAddress).balanceOf(TEST_USER);
        assertEq(zoraBalance, 250 ether, "Incorrect balance on Zora");
    }
} 