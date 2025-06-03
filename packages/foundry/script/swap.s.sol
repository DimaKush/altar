pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {IAltar} from "../contracts/IAltar.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}

contract swap is Script {
    address public routerAddress = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    IUniswapV2Router private router = IUniswapV2Router(routerAddress);

    function run(
        address altarAddress,
        uint amount,
        uint slippageTolerance
    ) external {
        address tokenIn = IAltar(altarAddress).blesedToBles(msg.sender);
        address tokenOut = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        if (slippageTolerance > 100 || slippageTolerance == 0) {
            slippageTolerance = 96;
        }
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint balance = IERC20(tokenIn).balanceOf(msg.sender);
        uint amountIn = 0;
        vm.startBroadcast();
        if (amount > balance) amountIn = balance;
        else amountIn = amount;
        IERC20(tokenIn).approve(routerAddress, amountIn);
        uint amountOutMin = getAmountOutMin(amountIn, path, slippageTolerance);
        uint deadline = block.timestamp + 15 minutes;
        router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );
        vm.stopBroadcast();
    }

    function getAmountOutMin(
        uint amountIn,
        address[] memory path,
        uint slippageTolerance
    ) internal view returns (uint amountOutMin) {
        uint[] memory amountsOut = router.getAmountsOut(amountIn, path);
        uint amountOut = amountsOut[1];
        amountOutMin = (amountOut * (100 - slippageTolerance)) / 100;
    }
}
