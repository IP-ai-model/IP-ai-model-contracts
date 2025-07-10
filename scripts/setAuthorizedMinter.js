const { ethers, deployments } = require("hardhat");

async function main() {

    const iPModelAddress = (await deployments.get("IPModel")).address;

    const IPModel = await ethers.getContractFactory("IPModel");
    const iPModel = IPModel.attach(iPModelAddress);

    const authorizedMinterAddress = (await deployments.get("IPModelMarketplace")).address;

    await iPModel.setAuthorizedMinter(
        authorizedMinterAddress,
        true // 设置为授权状态
    );
}

// 错误处理
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("脚本执行失败:", error);
        process.exit(1);
    });
