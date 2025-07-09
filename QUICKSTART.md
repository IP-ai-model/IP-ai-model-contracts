# 快速开始指南

## 🚀 一分钟快速体验

### 1. 安装依赖
```bash
npm install
```

### 2. 运行测试
```bash
npm test
```

### 3. 一键部署和演示
```bash
npx hardhat run scripts/initializeProject.js --network hardhat
```

## 📝 创建你的第一个 AI 模型组

### 方式一：交互式创建（推荐新手）
```bash
npx hardhat run scripts/interactiveCreateGroup.js --network hardhat
```

### 方式二：命令行创建（推荐开发者）
```bash
GROUP_NAME="我的AI模型" GROUP_DESCRIPTION="这是我的第一个AI模型" MAX_SUPPLY="100" PRICE="10" npx hardhat run scripts/quickCreateGroup.js --network hardhat
```

## 🛍️ 购买模型授权

运行初始化脚本后，按照控制台输出的示例代码进行操作：

```javascript
// 1. 授权代币支付
await testToken.approve(marketplaceAddress, price);

// 2. 购买模型授权
await marketplace.buyTokens(groupId, 1);

// 3. 查询我的授权
await ipModel.balanceOf(myAddress, groupId);
```

## 📚 更多文档

- [完整使用指南](README.md)
- [脚本使用说明](scripts/README.md)
- [测试报告](TEST_REPORT.md)
- [接口设计文档](INTERFACE_DESIGN.md)

## 💡 常用命令

```bash
# 编译合约
npx hardhat compile

# 运行测试
npm test

# 启动本地节点
npx hardhat node

# 部署到本地网络
npx hardhat deploy --network localhost

# 创建模型组
npx hardhat run scripts/createSingleGroup.js --network hardhat

# 查看帮助
npx hardhat help
```

## 🔧 环境配置

如需部署到测试网，创建 `.env` 文件：

```env
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
```

然后部署到测试网：

```bash
npx hardhat deploy --network sepolia
```

---

有问题？查看 [README.md](README.md) 获取详细说明！
