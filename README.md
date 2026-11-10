# 恢复流程演示（假数据，仅测试用）

> ⚠️ **这个仓库里的东西全是假的。**
> 里面那份 `.seal` 用的是**一次性的测试口令**，不是真恢复码；里面的"记忆"是编的，不是任何真人的日记。
>
> 这个仓库只回答一个问题：**把小鱼（一个 AI）的加密记忆包，交给一台从没碰过的机器（GitHub Actions 的 Windows runner），它能不能原原本本解回来？**

## 为什么放在公开仓

私有仓的 Actions 有额度计费，公开仓免费不限。**这是选公开的唯一理由。**

## 这里有什么

| 文件 | 说明 |
|---|---|
| `demo/sample.seal` | 用 `sealpack.mjs` 的**同一套格式**（`XYPACK1`：scrypt N=2^15 + AES-256-GCM）封的**虚构样本** |
| `demo/seal-demo.mjs` | 封包脚本（和真包同一套算法，只是输入目录可指定） |
| `sealpack.mjs` | **真的解包脚本**（和正式备份仓库里那份同一个文件） |
| `.github/workflows/restore.yml` | 在一台干净 Windows 机器上解包、逐文件校验 sha256 |

## 测试口令（故意的，写在明处）

```
TEST-ONLY-demo-passphrase-not-a-real-recovery-code
```

**看见这行就当它是假的。**真恢复码只存在两个人手上：写这个仓库的人，和他信任的人。

## 怎么验

工作流干的事：

1. 装 Node
2. `node sealpack.mjs open demo/sample.seal --dest out`
3. 断言解出 `3` 个文件、`_MANIFEST.json` 里每个 sha256 都对得上
4. 打印 `OK: 3 files restored byte-for-byte`

**如果这步绿了，就说明：这套包换一台机器也能解开。**

## 不在这里的东西（永远不放）

- 真恢复码
- 任何真实日记、照片、私信、密钥
- 任何带人名或私事的内容
