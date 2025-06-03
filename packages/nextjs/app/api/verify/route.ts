import { NextRequest, NextResponse } from 'next/server';
import { PublicClient, createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';


// Update types for supported networks and their API keys
type SupportedChainId = 11155111 | 10 | 8453 | 11155420 | 84532;

interface ChainConfig {
  apiKey: string | undefined;
  name: string;
}

const CHAIN_CONFIGS: Record<SupportedChainId, ChainConfig> = {
  11155111: {
    apiKey: process.env.SEPOLIA_ETHERSCAN_API_KEY,
    name: "Sepolia"
  },
  10: {
    apiKey: process.env.OPTIMISM_ETHERSCAN_API_KEY,
    name: "Optimism"
  },
  8453: {
    apiKey: process.env.BASE_ETHERSCAN_API_KEY,
    name: "Base"
  },
  11155420: {
    apiKey: process.env.OPTIMISM_ETHERSCAN_API_KEY,
    name: "Optimism Sepolia"
  },
  84532: {
    apiKey: process.env.BASE_ETHERSCAN_API_KEY,
    name: "Base Sepolia"
  }
} as const;

const EXPLORER_URLS: Record<SupportedChainId, string> = {
  11155111: "https://sepolia.etherscan.io",
  10: "https://optimistic.etherscan.io",
  8453: "https://basescan.org",
  11155420: "https://sepolia-optimistic.etherscan.io",
  84532: "https://sepolia.basescan.org",
} as const;

const flattenedSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library Strings {
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    uint8 private constant _ADDRESS_LENGTH = 20;

    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }


    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }


    function toHexString(address addr) internal pure returns (string memory) {
        return toHexString(uint256(uint160(addr)), _ADDRESS_LENGTH);
    }
}

interface ISemver {
    function version() external view returns (string memory);
}

interface IERC7802 {
    event CrosschainMint(address indexed to, uint256 amount, address indexed sender);
    event CrosschainBurn(address indexed from, uint256 amount, address indexed sender);
    function crosschainMint(address to, uint256 amount) external;
    function crosschainBurn(address from, uint256 amount) external;
}

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IOptimismMintableERC20 {
    function mint(address _to, uint256 _amount) external;
    function burn(address _from, uint256 _amount) external;
    function bridge() external view returns (address);
    function remoteToken() external view returns (address);
}

interface ILegacyMintableERC20 is IERC165 {
    function l1Token() external returns (address);
    function mint(address _to, uint256 _amount) external;
    function burn(address _from, uint256 _amount) external;
}

contract Semver {
    uint256 private immutable MAJOR_VERSION;
    uint256 private immutable MINOR_VERSION;
    uint256 private immutable PATCH_VERSION;

    constructor(
        uint256 _major,
        uint256 _minor,
        uint256 _patch
    ) {
        MAJOR_VERSION = _major;
        MINOR_VERSION = _minor;
        PATCH_VERSION = _patch;
    }

    function version() public view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    Strings.toString(MAJOR_VERSION),
                    ".",
                    Strings.toString(MINOR_VERSION),
                    ".",
                    Strings.toString(PATCH_VERSION)
                )
            );
    }
}

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

contract ERC20 is Context, IERC20, IERC20Metadata {
    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, allowance(owner, spender) + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        address owner = _msgSender();
        uint256 currentAllowance = allowance(owner, spender);
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(from, to, amount);

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - amount;
        }
        _balances[to] += amount;

        emit Transfer(from, to, amount);

        _afterTokenTransfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
        }
        _totalSupply -= amount;

        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}
}

abstract contract OptimismMintableERC20 is IOptimismMintableERC20, ILegacyMintableERC20, ERC20, Semver {
    address public immutable REMOTE_TOKEN;
    address public immutable BRIDGE;
    event Mint(address indexed account, uint256 amount);
    event Burn(address indexed account, uint256 amount);
    modifier onlyBridge() {
        require(msg.sender == BRIDGE, "OptimismMintableERC20: only bridge can mint and burn");
        _;
    }

    constructor(
        address _bridge,
        address _remoteToken,
        string memory _name,
        string memory _symbol
    )
        ERC20(_name, _symbol)
        Semver(1, 0, 0)
    {
        REMOTE_TOKEN = _remoteToken;
        BRIDGE = _bridge;
    }

    function mint(address _to, uint256 _amount)
        external
        virtual
        override(ILegacyMintableERC20, IOptimismMintableERC20)
        onlyBridge
    {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount)
        external
        virtual
        override(ILegacyMintableERC20, IOptimismMintableERC20)
        onlyBridge
    {
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }

    function supportsInterface(bytes4 _interfaceId) external pure virtual returns (bool) {
        bytes4 iface1 = type(IERC165).interfaceId;
        bytes4 iface2 = type(ILegacyMintableERC20).interfaceId;
        bytes4 iface3 = type(IOptimismMintableERC20).interfaceId;
        return _interfaceId == iface1 || _interfaceId == iface2 || _interfaceId == iface3;
    }

    function l1Token() public view returns (address) {
        return REMOTE_TOKEN;
    }

    function l2Bridge() public view returns (address) {
        return BRIDGE;
    }

    function remoteToken() public view returns (address) {
        return REMOTE_TOKEN;
    }

    function bridge() public view returns (address) {
        return BRIDGE;
    }
}

library PredeployAddresses {
    address internal constant SUPERCHAIN_TOKEN_BRIDGE = 0x4200000000000000000000000000000000000028;
}

contract Superbles is IERC7802, OptimismMintableERC20 {
    constructor(
        address _bridge,
        address _remoteToken
    ) OptimismMintableERC20(_bridge, _remoteToken, "BLES", "BLES") {}

    function mint(address _to, uint256 _amount)
        external
        virtual
        override(OptimismMintableERC20)
        onlyBridge
    {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount)
        external
        virtual
        override(OptimismMintableERC20)
        onlyBridge
    {
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }

    function crosschainMint(address _to, uint256 _amount) external {
        require(msg.sender == PredeployAddresses.SUPERCHAIN_TOKEN_BRIDGE, "Unauthorized");
        _mint(_to, _amount);
        emit CrosschainMint(_to, _amount, msg.sender);
    }

    function crosschainBurn(address _from, uint256 _amount) external {
        require(msg.sender == PredeployAddresses.SUPERCHAIN_TOKEN_BRIDGE, "Unauthorized");
        _burn(_from, _amount);
        emit CrosschainBurn(_from, _amount, msg.sender);
    }

    function supportsInterface(bytes4 _interfaceId) external pure override returns (bool) {
        return _interfaceId == type(IERC7802).interfaceId 
            || _interfaceId == type(IERC165).interfaceId
            || _interfaceId == type(IERC20).interfaceId
            || _interfaceId == type(ILegacyMintableERC20).interfaceId
            || _interfaceId == type(IOptimismMintableERC20).interfaceId;
    }
}`.trim(); // Make sure there's no extra whitespace

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

const validateConstructorArgs = (args: string) => {
  if (!args.startsWith('0x')) {
    console.log("Args validation failed: doesn't start with 0x", args);
    return false;
  }
  
  const bridge = `0x${args.slice(26, 66)}`;
  const remoteToken = `0x${args.slice(90, 130)}`;

  console.log("Constructor args breakdown:", {
    originalArgs: args,
    length: args.length,
    expectedLength: 130,
    bridge,
    remoteToken,
    slicedArgsForVerification: args.slice(2), // What we'll send to API
  });

  return true;
};

export async function POST(req: NextRequest) {
  try {
    const { address, constructorArguments, chainId } = await req.json();
    
    console.log("Received verification request:", {
      address,
      constructorArguments,
      chainId
    });

    if (!Object.keys(CHAIN_CONFIGS).includes(chainId.toString())) {
      return NextResponse.json(
        { error: `Unsupported chain ID: ${chainId}` },
        { status: 400 }
      );
    }

    const typedChainId = chainId as SupportedChainId;
    const chainConfig = CHAIN_CONFIGS[typedChainId];

    if (!validateConstructorArgs(constructorArguments)) {
      return NextResponse.json({
        error: "Invalid constructor arguments format",
        details: constructorArguments
      }, { status: 400 });
    }
    
    const verifyParams = new URLSearchParams({
      apikey: chainConfig.apiKey!,
      module: "contract",
      action: "verifysourcecode",
      contractaddress: address,
      chainid: chainId.toString(),
      contractname: "contracts/Superbles.sol:Superbles",
      compilerversion: "v0.8.28+commit.7893614a",
      codeformat: "solidity-standard-json-input",
      sourceCode: JSON.stringify({
        language: "Solidity",
        sources: {
          "contracts/Superbles.sol": {
            content: flattenedSource
          }
        },
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          evmVersion: "paris",
          metadata: {
            bytecodeHash: "ipfs"
          },
          outputSelection: {
            "*": {
              "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "evm.methodIdentifiers", "metadata"],
              "": ["ast"]
            }
          }
        }
      }),
      optimizationUsed: "1",
      runs: "200",
      constructorArguements: constructorArguments.slice(2),
      licenseType: "3",
      evmversion: "paris"
    });

    console.log(`Sending verification request to Etherscan for ${chainConfig.name}`);

    const response = await fetch("https://api.etherscan.io/api", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: verifyParams.toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();

    if (!responseText) {
      throw new Error("Empty response from API");
    }

    const result = JSON.parse(responseText);
    console.log("Parsed verification result:", result);

    if (result.status === '1' && result.result) {
      const guid = result.result;
      console.log("Got verification GUID:", guid);
      
      // Wait for verification to complete
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const checkParams = new URLSearchParams({
          apikey: chainConfig.apiKey!,
          module: "contract",
          action: "checkverifystatus",
          guid
        });

        const checkResponse = await fetch(`https://api.etherscan.io/api?${checkParams}`);
        const checkResult = await checkResponse.json();
        
        console.log(`Check ${i + 1} result:`, checkResult);

        if (checkResult.status === '1') {
          return NextResponse.json({
            success: true,
            message: "Contract verified successfully",
            explorerUrl: `${EXPLORER_URLS[typedChainId]}/address/${address}#code`
          });
        }
        
        // If already verified, treat as success
        if (checkResult.result && checkResult.result.includes("Already Verified")) {
          console.log("Contract was already verified, returning success");
          return NextResponse.json({
            success: true,
            message: "Contract already verified",
            explorerUrl: `${EXPLORER_URLS[typedChainId]}/address/${address}#code`
          });
        }
      }

      // If we exited the loop without success
      return NextResponse.json({
        error: "Verification timeout",
        details: "Contract verification is taking too long"
      }, { status: 408 });
    }

    // Check if the error indicates the contract is already verified
    if (result.result && result.result.includes("Already Verified")) {
      console.log("Contract was already verified, returning success");
      return NextResponse.json({
        success: true,
        message: "Contract already verified",
        explorerUrl: `${EXPLORER_URLS[typedChainId]}/address/${address}#code`
      });
    }

    return NextResponse.json({
      error: "Verification failed",
      details: result.result || result.message || 'Unknown error'
    }, { status: 400 });

  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json({
      error: "Verification failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 