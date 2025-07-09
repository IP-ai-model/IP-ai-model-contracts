const { ethers, deployments } = require("hardhat");

async function main() {

    const testTokenAddress = (await deployments.get("TestToken")).address;

    const TestToken = await ethers.getContractFactory("TestToken");
    const testToken = TestToken.attach(testTokenAddress);

    await testToken.mint(
        "0x6Ba404ba94ff9F578b43c23A31963e0303ea3B89", // 接收地址
        ethers.parseEther("1000") // 铸造数量
    );
}

// 错误处理
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("脚本执行失败:", error);
        process.exit(1);
    });
