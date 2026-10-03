---
title: Linux 备忘录
date: 2026-09-25
tags: ["linux", "运维", "备忘录"]
---

国内环境下的高频命令。换源和镜像放在最前面。

## 一、换源

### 1.1 apt（Debian / Ubuntu）

先备份，再替换：

```bash
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak
sudo sed -i 's|http://archive.ubuntu.com|https://mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list
sudo sed -i 's|http://security.ubuntu.com|https://mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list
sudo apt update
```

**Ubuntu 24.04+** 使用新格式 `/etc/apt/sources.list.d/ubuntu.sources`：

```bash
sudo sed -i 's|http://archive.ubuntu.com|https://mirrors.tuna.tsinghua.edu.cn|g' \
  /etc/apt/sources.list.d/ubuntu.sources
```

**Debian 12+** 使用 `/etc/apt/sources.list.d/debian.sources`，同理。

### 1.2 常用 apt 镜像源

| 源     | URL                                    |
| ------ | -------------------------------------- |
| 清华   | `https://mirrors.tuna.tsinghua.edu.cn` |
| 阿里云 | `https://mirrors.aliyun.com`           |
| 中科大 | `https://mirrors.ustc.edu.cn`          |
| 华为云 | `https://mirrors.huaweicloud.com`      |
| 网易   | `https://mirrors.163.com`              |

### 1.3 yum / dnf（RHEL / CentOS / Fedora）

```bash
# 备份
sudo cp -r /etc/yum.repos.d /etc/yum.repos.d.bak

# CentOS 7 换阿里云
sudo sed -i 's|mirrorlist=|#mirrorlist=|g' /etc/yum.repos.d/CentOS-*.repo
sudo sed -i 's|#baseurl=http://mirror.centos.org|baseurl=https://mirrors.aliyun.com|g' \
  /etc/yum.repos.d/CentOS-*.repo

sudo yum clean all
sudo yum makecache
```

**CentOS 8 / Stream** 需要先换 vault（官方源已下线）：

```bash
sudo sed -i 's|mirror.centos.org|mirrors.aliyun.com|g' /etc/yum.repos.d/*.repo
sudo sed -i 's|^#baseurl|baseurl|g' /etc/yum.repos.d/*.repo
sudo sed -i 's|^mirrorlist|#mirrorlist|g' /etc/yum.repos.d/*.repo
sudo dnf clean all && sudo dnf makecache
```

**Fedora**：

```bash
sudo sed -i 's|^metalink=|#metalink=|g' /etc/yum.repos.d/fedora*.repo
sudo sed -i 's|^#baseurl=http://download.example/pub/fedora/linux|baseurl=https://mirrors.tuna.tsinghua.edu.cn/fedora|g' \
  /etc/yum.repos.d/fedora*.repo
```

### 1.4 pacman（Arch）

编辑 `/etc/pacman.d/mirrorlist`，把国内源放前面：

```
Server = https://mirrors.tuna.tsinghua.edu.cn/archlinux/$repo/os/$arch
Server = https://mirrors.ustc.edu.cn/archlinux/$repo/os/$arch
```

或者一键：

```bash
sudo pacman -S reflector
sudo reflector --country China --latest 5 --sort rate --save /etc/pacman.d/mirrorlist
sudo pacman -Syyu
```

### 1.5 pip 换源

```bash
# 永久
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

# 或写入 ~/.pip/pip.conf (Linux) / %APPDATA%\pip\pip.ini (Windows)
# [global]
# index-url = https://pypi.tuna.tsinghua.edu.cn/simple
# trusted-host = pypi.tuna.tsinghua.edu.cn

# 一次性
pip install <pkg> -i https://pypi.tuna.tsinghua.edu.cn/simple
```

常用 pip 镜像：

| 源     | URL                                                       |
| ------ | --------------------------------------------------------- |
| 清华   | `https://pypi.tuna.tsinghua.edu.cn/simple`                |
| 阿里云 | `https://mirrors.aliyun.com/pypi/simple/`                 |
| 中科大 | `https://pypi.mirrors.ustc.edu.cn/simple/`                |
| 豆瓣   | `https://pypi.douban.com/simple/`                         |
| 华为云 | `https://mirrors.huaweicloud.com/repository/pypi/simple/` |

### 1.6 Docker 镜像加速

编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com",
    "https://mirror.baidubce.com",
    "https://ccr.ccs.tencentyun.com"
  ]
}
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
docker info | grep -A 5 "Registry Mirrors"
```

> 2024 年后很多公共镜像源已停服，以上仅供参考。企业环境建议自建 Harbor 或使用阿里云/腾讯云容器镜像服务。

### 1.7 Go module 代理

```bash
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=sum.golang.google.cn
```

### 1.8 Maven 换源

编辑 `~/.m2/settings.xml`：

```xml
<mirrors>
  <mirror>
    <id>aliyun</id>
    <mirrorOf>central</mirrorOf>
    <url>https://maven.aliyun.com/repository/public</url>
  </mirror>
</mirrors>
```

### 1.9 换源后必做

```bash
# apt
sudo apt update

# yum / dnf
sudo yum clean all && sudo yum makecache
sudo dnf clean all && sudo dnf makecache

# pacman
sudo pacman -Syyu
```

## 二、文件与目录

```bash
pwd                               # 当前目录
ls -alh                           # 详细列表
cd -                              # 上一个目录
mkdir -p a/b/c                    # 递归创建
rm -rf <dir>                      # 递归删除（危险）
cp -r <src> <dst>                 # 递归复制
mv <src> <dst>                    # 移动 / 重命名
ln -s <target> <link>             # 软链接
touch <file>
stat <file>
file <file>
```

### 查找

```bash
find . -name "*.log"                          # 按名
find . -type f -size +100M                    # >100M
find . -mtime -7                              # 7 天内
find . -name "*.tmp" -delete                  # 找到删除
find . -type f -exec chmod 644 {} \;          # 批量执行

which <cmd>                       # 命令路径
whereis <cmd>
locate <file>                     # 快速（需 updatedb）
```

## 三、文本处理

```bash
cat / less / head -n 20 / tail -n 20
tail -f <file>                    # 实时跟踪日志
tail -F <file>                    # rotate 后仍能跟踪

grep "p" <file>                   # 基本
grep -r -n -i "p" .               # 递归+行号+忽略大小写
grep -v "p" <file>                # 反选
grep -E "a|b" <file>              # 扩展正则
rg "p"                            # ripgrep（快，推荐）

sed 's/old/new/g' <file>          # 替换到 stdout
sed -i 's/old/new/g' <file>       # 原地替换
sed -i.bak 's/old/new/g' <file>   # 带备份
sed -n '10,20p' <file>            # 打印范围

awk '{print $1}' <file>           # 第一列
awk -F: '{print $1}' /etc/passwd
awk '$3 > 100 {print $1}' <file>

cut -d: -f1 /etc/passwd
sort <file>
sort -u <file>                    # 去重
uniq -c                           # 统计相邻（先 sort）
wc -l <file>
tr 'a-z' 'A-Z'
```

### 管道组合

```bash
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10
du -sh */ | sort -rh | head -10
```

## 四、权限

```bash
chmod 755 <file>
chmod +x <file>
chmod -R 644 <dir>
chown user:group <file>
chown -R user <dir>
chgrp group <file>
umask
```

数字权限：

| 数字 | 权限 |
| ---- | ---- |
| 4    | r--  |
| 5    | r-x  |
| 6    | rw-  |
| 7    | rwx  |

例：`755` = `rwxr-xr-x`，`644` = `rw-r--r--`。

特殊权限：

```bash
chmod u+s <file>                  # SUID
chmod g+s <dir>                   # SGID
chmod +t <dir>                    # Sticky（如 /tmp）
```

## 五、进程管理

```bash
ps aux
ps aux | grep nginx
pgrep -f "pattern"
pidof <name>

top                               # P 按 CPU，M 按内存
htop                              # 更友好

kill <pid>                        # SIGTERM
kill -9 <pid>                     # 强制
pkill -f "pattern"
killall <name>

nice -n 10 <cmd>
renice -n 5 -p <pid>

Ctrl+Z                            # 挂起
bg / fg / jobs
```

信号：

| 信号    | 编号 | 说明             |
| ------- | ---- | ---------------- |
| SIGHUP  | 1    | 挂起 / 重载      |
| SIGINT  | 2    | Ctrl+C           |
| SIGKILL | 9    | 强杀，不可捕获   |
| SIGTERM | 15   | 优雅退出（默认） |

## 六、网络

```bash
ip addr                           # 查看 IP
ip route
ss -tunlp                         # 监听端口（推荐）
netstat -tunlp                    # 老命令
lsof -i :8080                     # 谁占端口

ping <host>
ping -c 4 <host>
traceroute <host>
mtr <host>                        # 持续 traceroute

curl -I <url>                     # 只看头
curl -v <url>                     # 详细
curl -o file.zip <url>            # 下载
curl -X POST -d '{}' -H "Content-Type: application/json" <url>

wget <url>
wget -c <url>                     # 断点续传
wget -r -np <url>                 # 递归

dig <domain>
dig +short <domain>
nslookup <domain>
host <domain>
```

### 防火墙

```bash
# ufw（Ubuntu）
ufw status
ufw allow 22
ufw allow 80/tcp
ufw delete allow 80
ufw enable

# firewalld（CentOS）
firewall-cmd --list-all
firewall-cmd --add-port=8080/tcp --permanent
firewall-cmd --reload

# iptables
iptables -L -n -v
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

## 七、磁盘与内存

```bash
df -h                             # 磁盘
df -i                             # inode
du -sh <dir>
du -sh * | sort -rh | head -10

free -h                           # 内存
vmstat 1
iostat -x 1                       # 需 sysstat

lsblk
fdisk -l
mount /dev/sdb1 /mnt
umount /mnt
```

找大文件：

```bash
find / -type f -size +1G 2>/dev/null
du -ah / | sort -rh | head -20
```

## 八、压缩与归档

```bash
tar -czvf a.tar.gz <dir>          # 打包
tar -xzvf a.tar.gz                # 解包
tar -tzvf a.tar.gz                # 查看内容
tar -xzvf a.tar.gz -C /tmp

zip -r a.zip <dir>
unzip a.zip
unzip -l a.zip
unzip a.zip -d /tmp

gzip <file>
gunzip <file>.gz

zstd <file>                       # 快速压缩
xz -9 <file>                      # 高压缩
```

## 九、用户与权限

```bash
whoami
id
who
w
last

useradd -m -s /bin/bash <user>
passwd <user>
usermod -aG sudo <user>
userdel -r <user>

groupadd <group>
groups <user>

su - <user>
sudo <cmd>
sudo -i                           # 进 root shell
sudo -u <user> <cmd>
```

sudoers：

```bash
visudo
```

```
alice ALL=(ALL:ALL) ALL
%sudo ALL=(ALL:ALL) ALL
alice ALL=(ALL) NOPASSWD: ALL     # 免密
```

## 十、systemd

```bash
systemctl start/stop/restart/reload/status <svc>
systemctl enable/disable <svc>
systemctl is-active <svc>
systemctl list-units --type=service --state=running
systemctl daemon-reload

journalctl -u <svc>
journalctl -u <svc> -f
journalctl -u <svc> --since "1 hour ago"
journalctl -xe                    # 最近错误
journalctl -b                     # 本次启动
journalctl --disk-usage
journalctl --vacuum-size=500M     # 清理
```

unit 文件示例 `/etc/systemd/system/myapp.service`：

```ini
[Unit]
Description=My App
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/myapp
ExecStart=/usr/bin/node /opt/myapp/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now myapp
```

## 十一、SSH

```bash
ssh user@host
ssh -p 2222 user@host
ssh -i ~/.ssh/id_rsa user@host

ssh-keygen -t ed25519 -C "comment"
ssh-copy-id user@host

ssh -L 8080:localhost:80 user@host   # 本地转发
ssh -R 8080:localhost:80 user@host   # 远程转发
ssh -D 1080 user@host                # SOCKS 代理
```

`~/.ssh/config`：

```
Host myserver
    HostName 1.2.3.4
    User alice
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
```

之后 `ssh myserver` 即可。

### 传输

```bash
scp <file> user@host:/path/
scp user@host:/path/<file> .
scp -r <dir> user@host:/path/

rsync -avz --progress <src> user@host:<dst>   # 增量同步
rsync -avz --delete <src> user@host:<dst>
```

## 十二、软件包管理

### apt（Debian / Ubuntu）

```bash
sudo apt update                   # 更新索引
sudo apt upgrade                  # 升级
sudo apt full-upgrade             # 含依赖变化
sudo apt install <pkg>
sudo apt remove <pkg>             # 保留配置
sudo apt purge <pkg>              # 含配置
sudo apt autoremove               # 清理无用依赖
sudo apt search <kw>
sudo apt show <pkg>
apt list --installed

sudo dpkg -i <pkg>.deb
dpkg -l | grep <pkg>
```

### yum / dnf（RHEL / CentOS）

```bash
sudo yum install <pkg>
sudo yum remove <pkg>
sudo yum update
sudo yum search <kw>
sudo yum info <pkg>
yum list installed
yum clean all && yum makecache

sudo dnf install <pkg>            # 新一代
dnf upgrade
dnf clean all

sudo rpm -ivh <pkg>.rpm
rpm -qa | grep <pkg>
sudo rpm -e <pkg>
```

### pacman（Arch）

```bash
sudo pacman -Syu                  # 同步并升级
sudo pacman -S <pkg>
sudo pacman -Rns <pkg>            # 卸载含依赖配置
pacman -Ss <kw>
pacman -Qs <pkg>
```

## 十三、日志

```bash
journalctl -xe
journalctl --since today
journalctl -p err                 # 只错误

tail -f /var/log/syslog           # Debian/Ubuntu
tail -f /var/log/messages         # RHEL/CentOS
tail -f /var/log/auth.log         # 认证
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

dmesg
dmesg -T                          # 人类可读时间
dmesg | tail -20
```

## 十四、环境变量

```bash
env
echo $PATH
export FOO=bar
unset FOO

# 永久
~/.bashrc                         # bash 交互式
~/.bash_profile                   # bash 登录
~/.profile                        # 通用
/etc/profile                      # 全局

source ~/.bashrc

export PATH="$HOME/.local/bin:$PATH"      # 前置
export PATH="$PATH:/opt/tools/bin"        # 后置
```

## 十五、性能排查

```bash
uptime                            # 负载
top                               # 实时
free -h                           # 内存
df -h / df -i                     # 磁盘 / inode
iostat -x 1                       # IO
sar -u 1 5                        # CPU 历史
```

通用排查顺序：

1. `uptime` + `top`：负载高不高、哪个进程占用。
2. `free -h`：内存是否耗尽、是否 swap。
3. `df -h` + `df -i`：空间 / inode 是否满。
4. `iostat -x 1`：IO 是否瓶颈。
5. `ss -s`：连接数是否异常。

### 定位细节

```bash
lsof -p <pid>                     # 进程打开的文件
lsof -i :8080                     # 端口占用
lsof /var/log/syslog

top -H -p <pid>                   # 线程
ps -T -p <pid>

tcpdump -i eth0 -n
tcpdump -i eth0 port 80
tcpdump -i eth0 host 1.2.3.4
tcpdump -i eth0 -w cap.pcap       # 存盘（Wireshark 打开）
```

## 十六、定时任务

```bash
crontab -e                        # 编辑
crontab -l                        # 列出
crontab -r                        # 删除
```

格式：

```
* * * * * <command>
│ │ │ │ │
│ │ │ │ └─ 星期（0-7，0/7 都是周日）
│ │ │ └─── 月（1-12）
│ │ └───── 日（1-31）
│ └─────── 时（0-23）
└───────── 分（0-59）
```

例：

```
0 3 * * * /opt/backup.sh              # 每天 3:00
*/5 * * * * /usr/bin/check.sh         # 每 5 分钟
0 9-18 * * 1-5 /opt/work.sh           # 工作日 9-18 整点
```

注意事项：

- PATH 与登录 shell 不同，用绝对路径。
- 输出默认发邮件，重定向：`>> /var/log/job.log 2>&1`。
- 秒级任务用 systemd timer。

## 十七、实用技巧

```bash
history
history | grep <kw>
Ctrl+R                            # 反向搜索历史
!!                                # 上一条
!$                                # 上一条最后参数
!123                              # 历史编号 123

pushd /path / popd / dirs -v

nohup <cmd> > out.log 2>&1 &
disown

openssl rand -base64 16           # 随机密码
uuidgen
md5sum <file>
sha256sum <file>
xxd <file>
time <cmd>

python3 -m http.server 8000       # 快速 HTTP 服务
```

### 命令组合

```bash
cmd1 && cmd2                      # 成功才继续
cmd1 || cmd2                      # 失败才继续
cmd1 ; cmd2                       # 顺序
cmd1 &                            # 后台
(cmd1; cmd2)                      # 子 shell
```

### 变量

```bash
name="world"
echo "$name"
echo "${name}"
echo "$(date)"
echo '$name'                      # 不替换

: ${VAR:=default}                 # 默认值

str="hello.txt"

{% raw %}
echo ${str%.txt}                  # hello
echo ${str#hello.}                # txt
echo ${str/txt/md}                # hello.md
echo ${#str}                      # 9
{% endraw %}

```

## 十八、快捷键

| 快捷键              | 作用          |
| ------------------- | ------------- |
| `Ctrl+C`            | 中断          |
| `Ctrl+D`            | 退出 shell    |
| `Ctrl+L`            | 清屏          |
| `Ctrl+A` / `Ctrl+E` | 行首 / 行尾   |
| `Ctrl+U` / `Ctrl+K` | 删光标前 / 后 |
| `Ctrl+W`            | 删前一个单词  |
| `Ctrl+R`            | 搜索历史      |
| `Ctrl+Z`            | 挂起          |
| `Tab` / `Tab Tab`   | 补全 / 列候选 |

---

## 参考

- 清华镜像站：https://mirrors.tuna.tsinghua.edu.cn/
- 中科大镜像站：https://mirrors.ustc.edu.cn/
- 阿里云镜像站：https://developer.aliyun.com/mirror/
- npmmirror：https://npmmirror.com/
- man 手册：`man <command>`
- tldr：`tldr <command>`（需安装）
