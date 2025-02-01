pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {Vm} from "forge-std/Vm.sol";
import {Altar} from "../src/Altar.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISablierV2LockupLinear} from "@sablier/v2-core/src/interfaces/ISablierV2LockupLinear.sol";
import {LockupLinear} from "@sablier/v2-core/src/types/DataTypes.sol";
import {SablierV2Lockup} from "@sablier/v2-core/src/abstracts/SablierV2Lockup.sol";

interface IUniswapV2Router02 {
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint, uint, uint);
}

interface IUniswapV2Factory {
    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract AltarTest is Test {
    Altar altar;
    IERC20 torch;
    address public constant daoMultisig = 0x702CFd2e92ECA7a75Cd2EB35A9052252374ef02A;
    IERC20 public constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IUniswapV2Factory public constant factory = IUniswapV2Factory(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);
    IUniswapV2Router02 public constant router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    ISablierV2LockupLinear public constant lockupLinear = ISablierV2LockupLinear(0xAFb979d9afAd1aD27C5eFf4E27226E3AB9e5dCC9);
     
    address user = makeAddr("user");
    IERC20 bles;
    uint torchAmount;
    uint gift;
    uint ethAmount;
    uint blesAmount = 1 ether;
    uint pooledBles;
    uint256 constant SCALE = 10 ** 36;
    uint256 constant PHI = 1618033988749894848204586834365638118;



    function setUp() public {
        altar = new Altar(daoMultisig, address(factory), address(router), address(lockupLinear), address(WETH));
        torch = IERC20(altar.blesedToBles(address(altar)));
    }

    function test_spark(uint _ethAmount, uint _division, address _referral) public {
        // Use bound to ensure valid input ranges
        _division = bound(_division, 0, 12);
        _ethAmount = bound(_ethAmount, 0, 31_999_999 ether);

        deal(user, _ethAmount * 2 + 1 ether);
        vm.startPrank(user);

        if (_division >= 11) {
            vm.expectRevert(Altar.DivisionOutOfRange.selector);
            altar.spark{value: _ethAmount}(_division, _referral);
            return;
        }
        if (_ethAmount >= 32_000 ether || _ethAmount <= 3_200_000) {
            vm.expectRevert(Altar.EthAmountOutOfRange.selector);
            altar.spark{value: _ethAmount}(_division, _referral);
            return;
        }
        if (_referral == address(0)) {
            vm.expectRevert();
            altar.spark{value: _ethAmount}(_division, _referral);
            return;
        }

        uint altarBalanceBeforeSpark = address(altar).balance;
        altar.spark{value: _ethAmount}(_division, _referral);
        if (_division == 0) {
            assertEq(IERC20(altar.blesedToBles(user)).balanceOf(user), 10 ** 18);
            return;
        }

        address blesAddress = altar.blesedToBles(user);
        address pair = factory.getPair(blesAddress, address(WETH));
        bles = IERC20(blesAddress);

        torchAmount = (_ethAmount * _division) / 3_200_000;
        uint daoAmount = (torchAmount * SCALE) / PHI;
        uint referralAmount = (daoAmount * SCALE) / PHI;
        gift = (_ethAmount * 81) / 10_000; // 0.81%
        ethAmount = _ethAmount - gift;
        for (uint256 i = 0; i < _division; i++) {
            blesAmount = (blesAmount * SCALE) / PHI;
        }
        pooledBles = 1 ether - blesAmount;
        assertEq(altar.blesToBlesed(address(bles)), address(user));

        assertEq(bles.balanceOf(user), blesAmount);
        assertEq(bles.balanceOf(address(altar)), 0);
        assertEq(WETH.balanceOf(pair), ethAmount);
        assertEq(IERC20(bles).balanceOf(pair), pooledBles);
        if (_referral == user) {
            assertEq(torch.balanceOf(user), torchAmount + referralAmount);
        } else {
            assertEq(torch.balanceOf(user), torchAmount );
            assertEq(torch.balanceOf(_referral), referralAmount);
        }
        assertEq(torch.balanceOf(address(daoMultisig)), daoAmount);

        assertEq(
            address(altar).balance,
            altarBalanceBeforeSpark + (_ethAmount * 81) / 10000
        );

        if (_division != 0) {
            IUniswapV2Pair uniPair = IUniswapV2Pair(pair);
            
            (uint112 reserve0, uint112 reserve1,) = uniPair.getReserves();
            
            bool blesIsToken0 = uniPair.token0() == blesAddress;

            if (blesIsToken0) {
                assertEq(reserve0, pooledBles);
                assertEq(reserve1, ethAmount);
            } else {
                assertEq(reserve0, ethAmount);
                assertEq(reserve1, pooledBles);
            }

            assertEq(IERC20(pair).balanceOf(user), 0);
            assertEq(IERC20(pair).balanceOf(address(altar)), 0);
        }

        // Calculate 0.81% fee
        uint expectedFee = (_ethAmount * 81) / 10_000;
        
        // Check fee was taken correctly
        assertEq(
            address(altar).balance,
            altarBalanceBeforeSpark + expectedFee,
            "Incorrect fee amount"
        );

        // Check that the user cannot spark again
        vm.expectRevert(Altar.BlesedAlready.selector);
        altar.spark{value: _ethAmount}(_division, _referral);
    }


    function test_liquidityLock(uint _ethAmount, uint _division, address _referral) public {
        _ethAmount = bound(_ethAmount, 3_200_001, 31_999 ether);
        _division = bound(_division, 1, 10);
        deal(user, _ethAmount * 2);
        vm.startPrank(user);  
        vm.assume(_referral != address(0));
        vm.recordLogs();
        altar.spark{value: _ethAmount}(_division, _referral);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        
        uint256 streamId;
        uint256 blesAmount;
        uint256 torchAmount;
        uint256 liquidity;
        address referral;
        uint256 referralAmount;
        for (uint i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("Blesed(address,address,uint256,uint256,uint256,uint256,address,uint256)")) {
                (blesAmount, torchAmount, liquidity, streamId, referral, referralAmount) = abi.decode(logs[i].data, (uint256, uint256, uint256, uint256, address, uint256));
                break;
            }
        }
        
        console.log("Stream ID:", streamId);
        address blesAddress = altar.blesedToBles(user);
        address pair = factory.getPair(blesAddress, address(WETH));
        IERC20 lpToken = IERC20(pair);
        assertEq(lpToken.balanceOf(user), 0);
        assertEq(lpToken.balanceOf(address(altar)), 0);
        assertEq(lpToken.balanceOf(address(lockupLinear)), liquidity);
        console.log("Liquidity:", liquidity);
        console.log("Block timestamp:", block.timestamp);
        vm.warp(block.timestamp + 10004 days);
        console.log("Warpped to:", block.timestamp);
        console.log("Before withdrawal:");
        console.log("LP Balance Sablier:", lpToken.balanceOf(address(lockupLinear)));
        
        address(lockupLinear).call(
                abi.encodeWithSignature(
                    "withdrawMax(uint256,address)",
                    streamId,
                    user
                )
            );
        // uint256 withdrawn = lockupLinear.withdrawMax(streamId, user);
        
        console.log("After withdrawal:");
        // console.log("Withdrawn amount:", withdrawn);
        console.log("LP Balance User:", lpToken.balanceOf(user));
        console.log("LP Balance Sablier:", lpToken.balanceOf(address(lockupLinear)));
        assertEq(lpToken.balanceOf(address(lockupLinear)), 0);
        assertEq(lpToken.balanceOf(user), liquidity);
        
    }

    function test_refill(uint _ethAmount, uint _division, address _referral) public {
        _ethAmount = bound(_ethAmount, 3_200_001, 31_999 ether);
        _division = bound(_division, 0, 10);
        vm.assume(_referral != address(0));
        deal(user, _ethAmount * 2);
        vm.startPrank(user);  
        
        altar.spark{value: _ethAmount}(_division, _referral);
        if (_division == 0) return;       
        uint initialBalance = address(altar).balance;
        uint userTorchAmount = torch.balanceOf(user);
        uint initialBalanceOfTorch = torch.balanceOf(address(altar));

        torch.approve(address(altar), userTorchAmount); 
        altar.refill(userTorchAmount);

        assertEq(torch.balanceOf(address(altar)), initialBalanceOfTorch + userTorchAmount);
        assertEq(torch.balanceOf(user), 0);
        assertEq(
            address(altar).balance, 
            initialBalance - (initialBalance * userTorchAmount / 10**18)
        );
        vm.expectRevert();
        altar.refill(0);
    }


    function test_zeroDivision(uint _ethAmount, address _referral) public {
        _ethAmount = bound(_ethAmount, 3_200_001, 31_999 ether);
        deal(user, _ethAmount * 2);
        vm.startPrank(user);  
        uint altarBalanceBefore = address(altar).balance;
        altar.spark{value: _ethAmount}(0, _referral);
        uint altarBalanceAfter = address(altar).balance;
        assertEq(altarBalanceAfter, altarBalanceBefore + _ethAmount, "Provided ETH should be added to altar balance");
        assertEq(IERC20(altar.blesedToBles(user)).balanceOf(user), 10 ** 18, "User should receive full BLES amount");
    }


    function test_division(uint _ethAmount, uint _division, address _referral) public {
        _ethAmount = bound(_ethAmount, 3_200_001, 31_999 ether);
        _division = bound(_division, 1, 10);
        deal(user, _ethAmount * 2);
        vm.startPrank(user);  
        vm.assume(_referral != address(0));
        altar.spark{value: _ethAmount}(_division, _referral);
        uint expectedBlesAmount = 1 ether;
        for (uint256 i = 0; i < _division; i++) {
            expectedBlesAmount = (expectedBlesAmount * SCALE) / PHI;
        }
        assertEq(IERC20(altar.blesedToBles(user)).balanceOf(user), expectedBlesAmount, "User should receive correct BLES amount");
    }


    function test_refillInsufficientBalance(uint _ethAmount, uint _division, address _referral) public {
        _ethAmount = bound(_ethAmount, 3_200_001, 31_999 ether);
        _division = bound(_division, 0, 10);
        vm.assume(_referral != address(0));
        deal(user, _ethAmount * 2);
        vm.startPrank(user);  
        altar.spark{value: _ethAmount}(_division, _referral);
        uint torchBalance = torch.balanceOf(user);
        
        // Try to refill more than user has
        torch.approve(address(altar), torchBalance + 1);
        vm.expectRevert();
        altar.refill(torchBalance + 1);
    }
}
