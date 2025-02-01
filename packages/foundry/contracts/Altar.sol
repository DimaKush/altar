// BlesWithGrace

pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ud60x18} from "@prb/math/src/UD60x18.sol";
import {ISablierV2LockupLinear} from "@sablier/v2-core/src/interfaces/ISablierV2LockupLinear.sol";
import {Broker, LockupLinear} from "@sablier/v2-core/src/types/DataTypes.sol";

contract Bles is ERC20 {
    address public altar;
    address public blesed;
    constructor(address _blesed) ERC20("bles", "BLES") {
        _mint(msg.sender, 1 ether);
        altar = msg.sender;
        blesed = _blesed;
    }
}

contract Torch is ERC20 {
    address public altar;
    constructor() ERC20("torch", "TORCH") {
        _mint(msg.sender, 1 ether);
        altar = msg.sender;
    }
}

interface IUniswapV2Factory {
    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);
}

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

contract Altar {
    string public constant link = "Blesed.eth.limo";
    uint256 public constant SCALE = 10 ** 36;
    uint256 public constant PHI = 1618033988749894848204586834365638118;
    IUniswapV2Factory public factory;
    IUniswapV2Router02 public router;
    address public daoMultisig;
    IERC20 public weth;
    ISablierV2LockupLinear public lockupLinear;
    uint private locked = 1;

    mapping(address => address) public blesedToBles; // owner -> token
    mapping(address => address) public blesToBlesed; // token -> owner

    event Blesed(
        address indexed blesed,
        address indexed blesToken,
        uint256 blesAmount,
        uint256 torchAmount,
        uint256 liquidity,
        uint256 streamId,
        address referral,
        uint256 referralAmount
    );

    event Refilled(address indexed refiller, uint256 amount, uint256 ethAmount);

    error BlesedAlready();
    error EthAmountError();
    error DivisionOutOfRange();
    error EthAmountOutOfRange();
    error Locked();
    error NotRefiller();
    error ZeroAddress();
    error TransferFailed();
    error ZeroAmount();

    struct SparkVars {
        address torchAddress;
        uint256 blesAmount;
        uint256 torchAmount;
        uint256 ethAmount;
        uint256 liquidity;
        uint256 pooledBles;
        uint256 daoAmount;
        uint256 referralAmount;
        uint256 gift;
        uint256 pairStreamId;
        uint256 division;
        address referral;
    }

    constructor(
        address _daoMultisig,
        address _factory,
        address _router,
        address _lockupLinear,
        address _weth
    ) {
        address _torchAddress = address(new Torch());
        blesedToBles[address(this)] = _torchAddress;
        blesToBlesed[_torchAddress] = address(this);
        daoMultisig = _daoMultisig;
        factory = IUniswapV2Factory(_factory);
        router = IUniswapV2Router02(_router);
        lockupLinear = ISablierV2LockupLinear(_lockupLinear);
        weth = IERC20(_weth);
    }

    modifier lock() {
        if (locked != 1) revert Locked();
        locked = 2;
        _;
        locked = 1;
    }

    modifier once() {
        if (blesedToBles[msg.sender] != address(0)) revert BlesedAlready();
        _;
    }

    //  division: bles amount to receive
    //  0:	1000000000000000000 ~ 100.00%
    //  1:	 618033988749894848 ~  61.80%
    //  2:	 381966011250105151 ~  38.20%
    //  3:	 236067977499789695 ~  23.61%
    //  4:	 145898033750315454 ~  14.58%
    //  5:	  90169943749474240 ~   9.02%
    //  6:	  55728090000841213 ~   5.57%
    //  7:	  34441853748633025 ~   3.44%
    //  8:	  21286236252208186 ~   2.13%
    //  9:	  13155617496424837 ~   1.32%
    // 10:	   8130618755783347 ~   0.81%
    //
    // All remaining bles and eth are pooled and locked in UniswapV2Pool in case of nonzero division.

    // DYOR
    function spark(uint _division, address _referral) public payable lock once {
        SparkVars memory vars;
        vars.division = _division;
        vars.referral = _referral;
        vars.torchAddress = blesedToBles[address(this)];

        if (vars.division >= 11) revert DivisionOutOfRange();
        if (msg.value <= 3_200_000 || msg.value >= 32_000 ether) {
            revert EthAmountOutOfRange();
        }
        IERC20 bles = new Bles(msg.sender); // supply cap 10**18
        blesedToBles[msg.sender] = address(bles);
        blesToBlesed[address(bles)] = msg.sender;
        vars.blesAmount = 10 ** 18;
        if (vars.division == 0) {
            bles.transfer(msg.sender, vars.blesAmount);
            emit Blesed(
                msg.sender,
                blesedToBles[msg.sender],
                vars.blesAmount,
                0,
                0,
                0,
                vars.referral,
                0
            );
            return; // thx4eth
        }
        LockupLinear.CreateWithDurations memory params;
        vars.torchAmount = (msg.value * vars.division) / 3_200_000;
        vars.gift = (msg.value * 81) / 10_000; // 0.81%
        vars.ethAmount = msg.value - vars.gift;
        for (uint256 i = 0; i < vars.division; i++) {
            vars.blesAmount = (vars.blesAmount * SCALE) / PHI;
        }
        vars.pooledBles = 1 ether - vars.blesAmount;

        bles.approve(address(router), vars.pooledBles);
        (, , vars.liquidity) = router.addLiquidityETH{value: vars.ethAmount}(
            blesedToBles[msg.sender],
            vars.pooledBles,
            vars.pooledBles,
            vars.ethAmount,
            address(this),
            block.timestamp
        );

        IERC20 pair = IERC20(factory.getPair(address(bles), address(weth)));
        params.sender = msg.sender;
        params.recipient = msg.sender;
        params.totalAmount = uint128(vars.liquidity);
        params.asset = pair;
        params.cancelable = false;
        params.transferable = false;
        params.durations = LockupLinear.Durations({
            cliff: 0,
            total: 10000 days
        }); // 27.375 years of longevity motivation
        params.broker = Broker(address(0), ud60x18(0)); // advanced zero
        pair.approve(address(lockupLinear), vars.liquidity);

        // Create lockup for liquidity
        vars.pairStreamId = lockupLinear.createWithDurations(params); // lock liquidity
        bles.transfer(msg.sender, vars.blesAmount);

        vars.daoAmount = (vars.torchAmount * SCALE) / PHI;
        vars.referralAmount = (vars.daoAmount * SCALE) / PHI;
        // Will get TORCH tokens in case `vars.torchAmount + vars.daoAmount + vars.referralAmount <= remainingTorchBalanceOfAltar`
        if (
            IERC20(vars.torchAddress).balanceOf(address(this)) >=
            vars.torchAmount + vars.daoAmount + vars.referralAmount
        ) {
            IERC20(vars.torchAddress).transfer(msg.sender, vars.torchAmount);
            IERC20(vars.torchAddress).transfer(daoMultisig, vars.daoAmount);
            IERC20(vars.torchAddress).transfer(vars.referral, vars.referralAmount); // revert if address(0)
        } else {
            vars.torchAmount = 0;
        }
        emit Blesed(
            msg.sender,
            blesedToBles[msg.sender],
            vars.blesAmount,
            vars.torchAmount,
            vars.liquidity,
            vars.pairStreamId,
            vars.referral,
            vars.referralAmount
        );
    }

    function refill(uint amount) external {
        if (amount == 0) revert ZeroAmount();
        bool success = IERC20(blesedToBles[address(this)]).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        if (!success) revert TransferFailed();
        payable(msg.sender).transfer(
            (address(this).balance * amount) / 10 ** 18
        );
    }
}
