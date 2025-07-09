const { ethers, deployments } = require("hardhat");

async function main() {
    console.log("开始执行创建组脚本...");

    // 使用 hardhat-deploy 插件读取已部署的合约地址
    console.log("正在查找已部署的 IPModel 合约...");
    const ipModelDeployment = await deployments.get("IPModel");
    console.log("找到已部署的 IPModel 合约地址:", ipModelDeployment.address);

    // 连接到已部署的合约
    const IPModel = await ethers.getContractFactory("IPModel");
    let ipModel = IPModel.attach(ipModelDeployment.address);

    const testTokenAddress = (await deployments.get("TestToken")).address
    console.log("✅ TestToken 合约部署到:", testTokenAddress);

    // 创建多个组的示例
    const groupsToCreate = [
        {
            name: "MoonHarim",
            description: "K-pop girl group NOVA member, lead singer and storefront manager",
            maxSupply: 100,
            price: ethers.parseEther("50"), // 50 测试代币
            payToken: testTokenAddress
        },
        {
            name: "Jarvis",
            description: "MLB professional baseball player, outfielder for the Los Angeles Hawks",
            maxSupply: 100,
            price: ethers.parseEther("75"), // 75 测试代币
            payToken: testTokenAddress
        },
        {
            name: "Rin",
            description: "The primitive form of virtual songstress and emotion generation engine",
            maxSupply: 100,
            price: ethers.parseEther("100"), // 100 测试代币
            payToken: testTokenAddress
        },
        {
            name: "SuzukiHaruka",
            description: "Known for delicate emotional expression and 'transparent acting skills'",
            maxSupply: 100,
            price: ethers.parseEther("60"), // 60 测试代币
            payToken: testTokenAddress
        }
    ];

    console.log("\n开始创建代币组...");

    for (let i = 0; i < groupsToCreate.length; i++) {
        const group = groupsToCreate[i];

        try {
            console.log(`\n正在创建第 ${i + 1} 个组: ${group.name}`);

            // 调用 createGroup 函数
            const tx = await ipModel.createGroup(
                group.name,
                group.description,
                group.maxSupply,
                group.price,
                group.payToken
            );

            // 等待交易确认
            const receipt = await tx.wait();

            // 从事件中获取组ID
            const groupCreatedEvent = receipt.logs.find(log => {
                try {
                    const parsedLog = ipModel.interface.parseLog(log);
                    return parsedLog.name === 'GroupCreated';
                } catch (e) {
                    return false;
                }
            });

            if (groupCreatedEvent) {
                const parsedEvent = ipModel.interface.parseLog(groupCreatedEvent);
                const groupId = parsedEvent.args.groupId;
                console.log(`✅ 组创建成功! 组ID: ${groupId}`);
                console.log(`   交易哈希: ${tx.hash}`);
                console.log(`   Gas 使用: ${receipt.gasUsed.toString()}`);
            } else {
                console.log(`✅ 组创建成功! 交易哈希: ${tx.hash}`);
            }

        } catch (error) {
            console.error(`❌ 创建组 "${group.name}" 失败:`, error.message);
        }
    }

    // 查询创建的组信息
    console.log("\n查询已创建的组信息:");
    try {
        const groupCount = await ipModel.getGroupCount();
        console.log(`总共有 ${groupCount} 个组`);

        for (let i = 1; i <= groupCount; i++) {
            try {
                const groupInfo = await ipModel.getGroupInfo(i);
                console.log(`\n组 ${i}:`);
                console.log(`  名称: ${groupInfo[0]}`);
                console.log(`  描述: ${groupInfo[1]}`);
                console.log(`  最大供应量: ${groupInfo[2] == 0 ? '无限' : groupInfo[2].toString()}`);
                console.log(`  当前供应量: ${groupInfo[3].toString()}`);
                console.log(`  是否激活: ${groupInfo[4]}`);
                console.log(`  价格: ${groupInfo[5].toString()}`);
                console.log(`  支付代币: ${groupInfo[6]}`);
            } catch (error) {
                console.log(`  组 ${i}: 查询失败 - ${error.message}`);
            }
        }
    } catch (error) {
        console.error("查询组信息失败:", error.message);
    }

    console.log("\n脚本执行完成!");
}

// 错误处理
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("脚本执行失败:", error);
        process.exit(1);
    });
