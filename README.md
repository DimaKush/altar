# Altar

A protocol for creating personalized ERC20 tokens with automated liquidity provision and locking.

## Table of Contents
- [Overview](#overview)
- [Key Constants](#key-constants)
- [Core Mechanisms](#core-mechanisms)
  - [Spark](#spark)
  - [ETH Flow](#eth-flow)
  - [TORCH Distribution](#torch-distribution)
  - [Liquidity Management](#liquidity-management)
- [Architecture](#architecture)
- [Security Features](#security-features)
- [Contract Addresses](#contract-addresses)
- [Technical Details](#technical-details)
- [Usage Guide](#usage-guide)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Overview

Altar creates personalized ERC20 tokens (BLES) with automated liquidity provision and distribution of a shared reward token (TORCH).

### Philosophy of Bles: Personal Tokens as a New Paradigm for Value and Reputation

Bles is a revolutionary concept that redefines how individuals interact with value, reputation, and charity in a decentralized world. At its core, Bles is a personal token that represents an individual's commitment to their future, their community, and their reputation. By locking ETH for 10,000 days (approximately 27.4 years) and providing liquidity in a pool, users create a unique ecosystem where their personal token, Bles, becomes a vehicle for value exchange, charitable giving, and reputation building.

#### 1. Personal Tokens as a Commitment to the Future

When you lock ETH for 10,000 days, you are making a long-term commitment to yourself and your community. This locked ETH serves as the foundation for your Bles token, which is minted and backed by your locked liquidity. By doing so, you create a personalized financial instrument that reflects your dedication to your future and your willingness to share value with others.

- **One Bles per Address**: Each address can only create one Bles token, with a fixed supply of 1 * 10^18 tokens (1 Bles). This ensures that each Bles token represents a unique individual, making it a true 1:1 representation of a person in the digital economy.
- **Monthly Buybacks**: You can allocate a portion of your income (e.g., 5-10%) to buy back your Bles tokens. This is akin to a personal savings mechanism, but with a twist: instead of saving for yourself, you are creating value for others.
- **Charity Reinvented**: Instead of donating fiat or ETH, you donate your Bles tokens. Recipients can choose to hold or exchange them in the liquidity pool, giving them flexibility and control over how they use the value you've shared.

#### 2. Recipients as Shareholders of Your Success

When you donate Bles tokens, the recipients become shareholders of your personal token. This creates a unique dynamic where they are incentivized to see you succeed. The more you earn and buy back your Bles tokens, the more value they gain. This aligns the interests of the giver and the receiver, fostering a sense of shared purpose and mutual growth.

- **Value Creation**: As you buy back your Bles tokens, the demand for them increases, driving up their value in the liquidity pool. This creates a positive feedback loop where your success directly benefits those who hold your tokens.
- **Transparency and Trust**: Since all transactions are recorded on the blockchain, recipients can track the value of their Bles tokens in real-time. This transparency builds trust and strengthens the relationship between you and your community.

#### 3. A Safety Net and Capital Building Mechanism

By locking ETH and creating Bles tokens, you are effectively building a personal safety net and a capital reserve. The liquidity pool acts as a decentralized vault, ensuring that your tokens have intrinsic value and can always be exchanged for ETH.

- **Pillow of Security**: The locked ETH serves as a cushion for your financial future, while the Bles tokens represent your active engagement with your community.
- **Community-Driven Capital**: As more people buy and hold your Bles tokens, your personal capital grows. This creates a decentralized network of support, where your community becomes your financial backbone.

#### 4. Bles as a Reputation Token

When you publicly link your identity to your Bles token, it becomes a token of reputation. People can buy and hold your Bles tokens as a way to show their belief in you and your potential. This transforms Bles into a social currency that reflects your influence, credibility, and trustworthiness.

- **Reputation on the Blockchain**: Your Bles token becomes a verifiable record of your contributions, commitments, and success. It is a living testament to your reputation in the decentralized world.
- **Investing in People**: By buying Bles tokens of individuals you believe in, you are not just investing in their future—you are also participating in their journey and sharing in their success.

#### 5. Torch: Ownership in the Altar

When you mint your Bles token, you also receive a small amount of Torch, the native token of the Altar. Torch represents ownership in the Altar itself, and there is only one Torch token in existence, with a fixed supply of 1 * 10^18 tokens (1 Torch).

- **Fractional Ownership**: The amount of Torch you receive represents your percentage ownership of the Altar. This means you are not just a participant in the Bles ecosystem—you are also a stakeholder in the Altar, the central hub of the Bles network.
- **Convertible Value**: Torch is always backed by ETH held in the Altar. You can return your Torch at any time to claim your share of the ETH, making it a liquid and flexible asset. This is facilitated by the refill function, which allows users to replenish the Altar's Torch tokens in exchange for ETH.
- **Governance and Influence**: As a Torch holder, you have a vested interest in the growth and success of the Altar. This creates a decentralized governance model where stakeholders are incentivized to contribute to the ecosystem's development.

#### 6. The Bigger Vision

Bles is not just about personal tokens; it is about redefining how we think about value, charity, and reputation in a decentralized world. It is about creating a system where individuals can thrive together, where success is shared, and where trust is built on transparency and mutual benefit.

- **A Decentralized Future**: Bles empowers individuals to take control of their financial future, build their reputation, and contribute to their community in a meaningful way.
- **A New Social Contract**: By aligning incentives and fostering trust, Bles creates a new social contract where everyone benefits from the success of others.

See blesed.eth.limo

## Key Constants
- **SCALE**: 1e36 (fixed-point precision)
- **PHI**: 1.618033988749894848204586834365638118 (golden ratio)
- **Min ETH**: 3.2M wei
- **Max ETH**: 32K ETH
- **Protocol Fee**: 0.81%
- **Lockup Period**: 10,000 days (~27.4 years)

## Core Mechanisms

### Spark

#### [Usage](https://etherscan.io/address/0x5d36d947ec045ef3e1143a9c57658d8dc1103a6d#writeContract#F2)

```solidity
function spark(uint _division, address _referral) public payable lock once {
    // ...
}
```

**Division determines BLES token split:**

| Division | User Gets | To Pool |
|----------|-----------|---------|
| 0        | 100.00%   | 0%      |
| 1        | 61.80%    | 38.20%  |
| 2        | 38.20%    | 61.80%  |
| 3        | 23.61%    | 76.39%  |
| 4        | 14.58%    | 85.42%  |
| 5        | 9.02%     | 90.98%  |
| 6        | 5.57%     | 94.43%  |
| 7        | 3.44%     | 96.56%  |
| 8        | 2.13%     | 97.87%  |
| 9        | 1.32%     | 98.68%  |
| 10       | 0.81%     | 99.19%  |

Referral receives TORCH rewards from the protocol.

#### ETH Flow

- **Division 0**: 100.00% → Stays in contract as donation
- **Division 1-10**: 
  - 0.81% → Protocol (vars.gift)
  - 99.19% → Used to create Uniswap V2 LP with BLES tokens

#### TORCH Distribution

For successful nonzero division sparks:
1. **User**: `(ETH * division) / 3_200_000`
2. **DAO**: `((ETH * division) / 3_200_000) / PHI`
3. **Referral**: `(((ETH * division) / 3_200_000) / PHI) / PHI`

All distributions fail if: `Altar_TORCH_Balance < torchAmount + daoAmount + referralAmount`

#### Liquidity Management

- Non-zero divisions: Remaining BLES + ETH auto-pooled
- LP tokens locked in Sablier V2
- Non-cancelable, non-transferable streams
- 10,000 day lockup period

#### Example Calculations

For 1 ETH input, division 1:
- **User BLES**: 0.618033988749894848 BLES (61.8033988749894848%)
- **Pooled BLES**: 0.381966011250105152 BLES (38.1966011250105152%)
- **Protocol Fee**: 0.0081 ETH (0.81%)
- **Pooled ETH**: 0.9919 ETH (99.19%)

- **User TORCH**: 1 ETH * 1 / 3_200_000 = 0.0000003125 TORCH (0.00003125%)
- **DAO TORCH**: 0.0000003125 / PHI = 0.000000193 TORCH (0.0000193%)
- **Referral TORCH**: 0.000000193 / PHI = 0.000000119 TORCH (0.0000119%)

For 1 ETH input, division 0:
- **User BLES**: 1 ETH (100.00%)
- **Pooled BLES**: 0 ETH (0.00%)
- **Donated ETH**: 1 ETH (100.00%)

- **User TORCH**: 0 TORCH (0.00%)
- **DAO TORCH**: 0 TORCH (0.00%)
- **Referral TORCH**: 0 TORCH (0.00%)

## Refill

#### [Usage](https://etherscan.io/address/0x5d36d947ec045ef3e1143a9c57658d8dc1103a6d#writeContract#F1)

```solidity
function refill(uint256 amount) external {
    // amount in TORCH tokens
    // Receives proportional ETH from contract
}
```

The refill function allows any user to:
1. Send TORCH tokens to Altar
2. Receive proportional ETH from contract's balance
3. Calculation: `ethAmount = (address(this).balance * amount) / 10**18`

#### Example Calculations

- **Contract Balance**: 10 ETH
- **TORCH sent**: 0.5 TORCH
- **ETH received**: 5 ETH (10 * 0.5)

**Notes**:
- Amount must be > 0
- Contract must have sufficient ETH balance
- TORCH transfer must succeed
- ETH transfer must succeed

## Architecture

**Core Components**:
- **Altar**: Main contract
- **BLES**: Personal token
- **TORCH**: Reward token
- **UniswapV2**: Liquidity pools
- **SablierV2**: LP token locking

## Security Features

- Reentrancy protection via `lock()` modifier
- Single-use per address via `once()` modifier
- Non-upgradeable contracts
- No admin functions
- No cancellable streams
- No transferable streams

## Contract Addresses

**Mainnet**:
- **Altar**: [0x5D36d947ec045eF3e1143A9c57658D8dC1103a6d](https://etherscan.io/address/0x5d36d947ec045ef3e1143a9c57658d8dc1103a6d#code)
- **TORCH**: [0x954101BE56Ce707aA513b34d091e10424F8944ea](https://etherscan.io/address/0x954101BE56Ce707aA513b34d091e10424F8944ea#code)

## Development

### Prerequisites

- Node.js
- Foundry
- Git

### Setup

```bash
git clone https://github.com/DimaKush/Altar.git
cd altar
forge install --no-commit sablier-labs/v2-core OpenZeppelin/openzeppelin-contracts@v5.0.2 PaulRBerg/prb-math@v4.0.3 foundry-rs/forge-std
```

### Testing

```bash
# Fork mainnet
anvil --fork-url $ETH_RPC_URL

# Run tests
forge test --rpc-url http://localhost:8545

# Run app
cd app
npm install
npm run start
```

## Troubleshooting

### Common Issues

1. **"Division out of range"**
   - Ensure division is 0-10
2. **"ETH amount error"**
   - Check ETH amount is 3.2M wei - 32K ETH
3. **"Already blessed"**
   - Address can only spark once

## Disclaimer

This project is for fun purposes only. Use at your own risk.
