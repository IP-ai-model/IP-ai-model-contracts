# IP AI Model Contracts

一个基于以太坊智能合约的 AI 模型知识产权管理和交易平台。该项目实现了 AI 模型的代币化、权限管理和市场交易功能。

## 项目概述

本项目包含三个核心智能合约：

- **IPModel**: 基于 ERC1155 标准的 AI 模型 NFT 合约，管理模型组的创建、铸造和权限
- **IPModelMarketplace**: 市场合约，处理代币支付和模型购买
- **TestToken**: ERC20 测试代币，用于支付和演示

## 功能特性

### 🎯 核心功能
- ✅ AI 模型代币化（ERC1155 NFT）
- ✅ 灵活的权限管理系统
- ✅ ERC20 代币支付集成
- ✅ 可配置的供应量限制
- ✅ 去中心化市场交易
- ✅ 批量操作支持

### 🔐 权限管理
- 合约所有者可以创建模型组
- 授权铸造者可以铸造代币
- 用户可以通过市场购买模型授权

### 💰 经济模型
- 每个模型组可设置独立价格
- 支持任意 ERC20 代币作为支付方式
- 收益自动转入指定地址

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn
- Hardhat 开发环境

### 安装依赖

```bash
npm install
```

### 编译合约

```bash
npx hardhat compile
```

### 运行测试

```bash
# 运行所有测试
npm test
```

### 部署合约

#### 本地开发网络

```bash
# 启动本地节点
npx hardhat node

# 在另一个终端部署合约
npx hardhat deploy --network localhost
```

#### 使用一键初始化脚本

```bash
# 部署所有合约并初始化示例数据
npx hardhat deploy --network hardhat
```

## 脚本使用指南

项目提供了多个便捷的脚本来操作合约：

### 1. 创建代币组

#### 交互式创建（推荐新手）
```bash
npx hardhat run scripts/interactiveCreateGroup.js --network localhost
```

#### 批量创建1155 group
```bash
npx hardhat run scripts/createGroup.js --network hardhat
```

### 环境变量配置

创建 `.env` 文件：

```env
PRIVATE_KEY=your_private_key_here
```

### 部署到测试网

```bash
# 部署到 Sepolia
npx hardhat deploy --network sepolia

# 部署到 Arbitrum Sepolia
npx hardhat deploy --network arb-t

# 部署到 Base Sepolia
npx hardhat deploy --network base-sepolia
```

## 安全特性

### 权限控制
- 使用 OpenZeppelin 的 `Ownable` 模式
- 细粒度的铸造权限管理
- 合约暂停和激活机制

### 重入保护
- 市场合约使用 `ReentrancyGuard`
- 状态更新在外部调用之前完成

### 输入验证
- 完整的参数验证
- 溢出保护（Solidity 0.8+）
- 零地址检查

## 项目结构

```
├── contracts/                 # 智能合约
│   ├── IPModel.sol            # 主合约
│   ├── IPModelMarketplace.sol # 市场合约
│   ├── TestToken.sol          # 测试代币
│   └── interfaces/            # 接口定义
├── scripts/                   # 部署和工具脚本
│   ├── createGroup.js         # 批量创建组
│   ├── createSingleGroup.js   # 单个创建组
│   ├── quickCreateGroup.js    # 快速创建组
│   ├── interactiveCreateGroup.js # 交互式创建
│   ├── initializeProject.js   # 项目初始化
│   └── README.md             # 脚本使用说明
├── test/                      # 测试文件
│   ├── IPModel.test.js        # 主合约测试
│   ├── IPModelMarketplace.test.js # 市场测试
│   └── IPModel.integration.test.js # 集成测试
├── deploy/                    # 部署脚本
└── docs/                      # 文档
```