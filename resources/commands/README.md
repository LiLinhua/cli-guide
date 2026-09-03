# 命令数据目录说明 (CLI-GUIDE)

本目录存放自定义命令库。应用启动时读取本目录全部 `*.json` 文件, 与内置库合并加载: 条目 `id` 与内置同名时覆盖内置, 其余追加。新增/修改/删除 JSON 文件后, **重启应用**生效。文件名随意, 建议按分类命名 (如 `git.json`)。

每个文件支持以下两种格式之一。

## 格式一: 补充命令 (JSON 数组)

向已有分类追加命令, 或按 `id` 覆盖内置命令:

```json
[
  {
    "id": "my-ls",
    "cmd": "ls -lh",
    "cat": "linux",
    "desc": "人类可读大小列目录",
    "syntax": "ls [-lh] [path]",
    "args": [{ "name": "-h", "desc": "容量单位" }],
    "examples": [{ "cmd": "ls -lh", "comment": "查看当前目录" }],
    "tags": ["目录"]
  }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 全局唯一标识, 与内置命令同名时覆盖内置版本 |
| `cmd` | string | 命令本体或快捷键 |
| `cat` | string | 所属分类 key, 须与某个分类一致 (见各内置 JSON 头部的 `cat`) |
| `desc` | string | 一句话描述, 参与搜索匹配 |
| `syntax` | string | 详情页语法行 |
| `args` | array | 参数说明, 元素格式 `{ "name": "参数名", "desc": "说明" }` |
| `examples` | array | 使用示例, 元素格式 `{ "cmd": "命令", "comment": "注释" }` |
| `tags` | array | 标签字符串数组 |

## 格式二: 新增分类 (JSON 对象)

新增一个完整分类, 重启后命令面板自动出现对应分类 chip:

```json
{
  "cat": "git",
  "label": "git 命令",
  "order": 14,
  "commands": [
    {
      "id": "git-status",
      "cmd": "git status",
      "cat": "git",
      "desc": "查看工作区状态",
      "syntax": "git status [-s]",
      "args": [{ "name": "-s", "desc": "简短输出" }],
      "examples": [{ "cmd": "git status", "comment": "查看状态" }],
      "tags": ["git"]
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cat` | string | 分类 key, 所有文件间唯一; `commands` 内条目的 `cat` 须与之一致, 否则整个文件的元数据按无效处理(仅加载命令条目) |
| `label` | string | 分类 chip 显示文案; 缺省时显示 `cat` 的值 |
| `order` | number | 分类 chip 排序序号(升序); 缺省时排在已声明分类之后按名称排序 |
| `commands` | array | 该分类的命令条目, 字段同格式一 |

## 注意事项

- 非法 JSON 文件会被跳过并在启动日志提示, 不影响其他文件加载。
- 某文件 `cat` 与其 `commands` 内条目不一致时, 命令条目仍会加载, 但该文件的 `label`/`order` 元数据被忽略。
- 内置库文件 (linux.json 等 13 个) 仅在缺失时由应用复制到本目录, 之后以本目录为准; 删除某个内置文件后重启可重新复制, 用于获取应用升级后的内置库修正。
- 本 README 仅为文档, 不会被应用加载或覆盖。
