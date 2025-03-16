# Monad NFT 交易工具

一个用于在 Monad 测试网上进行 NFT mint 操作的Web工具。

## 功能特点

- 支持输入私钥和NFT合约地址
- 自动获取历史mint价格（带重试机制）
- 支持手动输入mint价格
- 实时显示钱包余额
- 详细的交易状态显示
- 美观的Web界面

## 使用方法

1. 克隆仓库：
```bash
git clone https://github.com/EXLF/MonadTools.git
cd MonadTools
```

2. 在浏览器中访问：
- 直接双击打开 index.html 文件

## 使用说明

1. 输入你的私钥（以0x开头）
2. 输入要mint的NFT合约地址
3. 选择性输入mint价格：
   - 留空：系统会自动从历史交易中获取价格
   - 手动输入：使用指定的价格进行mint
4. 设置mint数量（默认为1）
5. 点击"开始Mint"按钮
6. 等待交易完成

## 注意事项

- 请确保你的钱包中有足够的MON代币
- 私钥不会被保存或传输到任何外部服务器
- 所有操作都在本地浏览器中完成
- 建议在进行大额交易前先进行小额测试

## 技术栈

- HTML5
- CSS3
- JavaScript (ES6+)
- Web3.js
- Monad Testnet RPC

## 安全提示

- 永远不要将你的私钥分享给他人
- 建议在专用的测试钱包中使用此工具
- 在进行任何操作前，请仔细核对所有信息

## 作者与社区

- 推特：[@xiao_yi24405](https://x.com/xiao_yi24405)
- Discord社区：[Four Air](https://discord.gg/cTZCaYefPY)
- 空投教程：[FOUR AIR 空投指南](https://valley-porkpie-151.notion.site/FOUR-AIR-1b28d09e75b680eb8b0ce426fdcd40a7?pvs=4)

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT 