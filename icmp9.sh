#!/bin/sh

#═══════════════════════════════════════════════════════════════════════════════
#
#  ICMP9.COM 网络切换脚本
#
#  版本:    2.6
#  适配:    Alpine Linux / Debian / Ubuntu (IPv4 + IPv6)
#  功能:    VMess 代理 + TUN网卡/全局代理
#
#  开发:    Claude (Anthropic)
#  协助:    ICMP9.COM
#  许可:    MIT License
#
#═══════════════════════════════════════════════════════════════════════════════

# Alpine 自举：如果没有 bash 和 curl，先安装
if [ -f /etc/alpine-release ]; then
    if ! command -v bash >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
        echo "正在安装基础依赖 (bash, curl)..."
        apk update >/dev/null 2>&1
        apk add --no-cache bash curl >/dev/null 2>&1
        # 用 bash 重新执行脚本
        exec bash "$0" "$@"
    fi
fi

# 确保用 bash 执行
if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

readonly VERSION="2.7"
readonly CONFIG_DIR="/etc/icmp9"
readonly CONFIG_FILE="$CONFIG_DIR/xray.json"
readonly STATE_FILE="$CONFIG_DIR/state"
readonly UUID_FILE="$CONFIG_DIR/uuid"
readonly MODE_FILE="$CONFIG_DIR/mode"
readonly PAUSE_FILE="$CONFIG_DIR/paused"
readonly BACKUP_ROUTE="$CONFIG_DIR/route_backup"
readonly TUN_NAME="other"
readonly TUN_IP4="10.0.85.1"
readonly TUN_GW4="10.0.85.2"
readonly TUN_IP6="fd00:85::1"
readonly TUN_GW6="fd00:85::2"
readonly SOCKS_PORT="10808"
readonly REDIR_PORT="10809"
readonly API_CONFIG="https://api.icmp9.com/config/config.txt"
readonly API_NODES="https://api.icmp9.com/online.php"

# 二进制文件下载源 (支持纯 IPv6)
readonly API_BASE="https://api.icmp9.com"
readonly API_BIN="${API_BASE}/bin"

# 颜色
R='\e[31m'; G='\e[32m'; Y='\e[33m'; B='\e[34m'; C='\e[36m'; W='\e[97m'; D='\e[2m'; NC='\e[0m'

# 错误处理
set -o pipefail
trap 'error_handler $? $LINENO' ERR

error_handler() {
    local exit_code=$1
    local line_no=$2
    # 静默处理，不中断脚本
    return 0
}

#═══════════════════════════════════════════════════════════════════════════════
# 系统检测
#═══════════════════════════════════════════════════════════════════════════════

# 检测发行版
detect_distro() {
    if [[ -f /etc/alpine-release ]]; then
        echo "alpine"
    elif [[ -f /etc/debian_version ]]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

DISTRO=$(detect_distro)

#═══════════════════════════════════════════════════════════════════════════════
# 界面函数
#═══════════════════════════════════════════════════════════════════════════════

_line()  { echo -e "${D}─────────────────────────────────────────────${NC}"; }
_dline() { echo -e "${C}═════════════════════════════════════════════${NC}"; }
_title() { echo -e "${W}$1${NC}"; }
_info()  { echo -e "  ${C}▸${NC} $1"; }
_ok()    { echo -e "  ${G}✓${NC} $1"; }
_err()   { echo -e "  ${R}✗${NC} $1"; }
_warn()  { echo -e "  ${Y}!${NC} $1"; }
_item()  { echo -e "  ${G}$1${NC}) $2"; }

_header() {
    clear
    echo ""
    _dline
    echo -e "        ${W}ICMP9.COM${NC} ${D}网络切换${NC} ${C}v${VERSION}${NC}"
    echo -e "        ${D}Developed by Claude (Anthropic)${NC}"
    _dline
}

_pause() {
    echo ""
    read -rp "  按回车继续..."
}

#═══════════════════════════════════════════════════════════════════════════════
# 系统检测
#═══════════════════════════════════════════════════════════════════════════════

check_root() {
    [[ $EUID -ne 0 ]] && { _err "请使用 root 权限运行"; exit 1; }
}

check_cmd() { command -v "$1" &>/dev/null; }

# 下载文件 (从 api.icmp9.com)
download_file() {
    local url=$1
    local output=$2

    _info "下载: $(basename "$url")..."
    if curl -sLo "$output" --connect-timeout 15 --max-time 300 "$url" 2>/dev/null; then
        if [[ -s "$output" ]]; then
            return 0
        fi
        rm -f "$output"
    fi
    return 1
}

get_default_gw4() { ip -4 route show default 2>/dev/null | awk '{print $3; exit}'; }
get_default_dev4() { ip -4 route show default 2>/dev/null | awk '{print $5; exit}'; }
get_default_gw6() { ip -6 route show default 2>/dev/null | awk '{print $3; exit}'; }
get_default_dev6() { ip -6 route show default 2>/dev/null | awk '{print $5; exit}'; }

check_installed() {
    [[ -d "$CONFIG_DIR" && -f "$UUID_FILE" ]]
}

# 检查服务是否存在 (兼容 systemd 和 OpenRC)
check_service_exists() {
    if [[ "$DISTRO" == "alpine" ]]; then
        [[ -f "/etc/init.d/icmp9-xray" ]]
    else
        [[ -f "/etc/systemd/system/icmp9-xray.service" ]]
    fi
}

is_paused() { [[ -f "$PAUSE_FILE" ]]; }

get_mode() { [[ -f "$MODE_FILE" ]] && cat "$MODE_FILE" || echo "tun"; }
get_country() { [[ -f "$STATE_FILE" ]] && cat "$STATE_FILE" || echo ""; }
get_uuid() { [[ -f "$UUID_FILE" ]] && cat "$UUID_FILE" || echo ""; }

# 带重试的网络请求
fetch_url() {
    local url=$1 retry=${2:-3}
    for ((i=1; i<=retry; i++)); do
        result=$(curl -sf --connect-timeout 10 --max-time 20 "$url" 2>/dev/null)
        [[ -n "$result" ]] && { echo "$result"; return 0; }
        sleep 1
    done
    return 1
}

#═══════════════════════════════════════════════════════════════════════════════
# 依赖安装
#═══════════════════════════════════════════════════════════════════════════════

install_deps() {
    _info "检查系统依赖..."

    if [[ "$DISTRO" == "alpine" ]]; then
        install_deps_alpine
    else
        install_deps_debian
    fi
}

# Alpine Linux 依赖安装
install_deps_alpine() {
    local need_install=()
    check_cmd curl   || need_install+=(curl)
    check_cmd jq     || need_install+=(jq)
    check_cmd unzip  || need_install+=(unzip)
    check_cmd ip     || need_install+=(iproute2)
    check_cmd file   || need_install+=(file)
    check_cmd bash   || need_install+=(bash)

    # iptables for global mode
    check_cmd iptables || need_install+=(iptables)

    # ip6tables 需要额外包
    check_cmd ip6tables || need_install+=(ip6tables)

    # getent 命令 (用于 DNS 解析)
    check_cmd getent || need_install+=(gcompat)

    if [[ ${#need_install[@]} -gt 0 ]]; then
        _info "安装: ${need_install[*]}"
        apk update &>/dev/null
        apk add --no-cache "${need_install[@]}" &>/dev/null || {
            _err "依赖安装失败"; return 1
        }
    fi

    # 加载 TUN 模块 (Alpine 默认可能未加载)
    if ! lsmod | grep -q "^tun "; then
        _info "加载 TUN 内核模块..."
        modprobe tun 2>/dev/null || {
            _warn "TUN 模块加载失败，尝试安装..."
            apk add --no-cache linux-lts 2>/dev/null || true
            modprobe tun 2>/dev/null || true
        }
    fi

    # 确保 /dev/net/tun 存在
    if [[ ! -c /dev/net/tun ]]; then
        mkdir -p /dev/net
        mknod /dev/net/tun c 10 200 2>/dev/null || true
        chmod 666 /dev/net/tun 2>/dev/null || true
    fi

    # 获取系统架构
    local arch=$(uname -m)
    local bin_arch
    case $arch in
        x86_64)  bin_arch="amd64" ;;
        aarch64) bin_arch="arm64" ;;
        armv7l)  bin_arch="armv7" ;;
        *) _err "不支持的架构: $arch"; return 1 ;;
    esac

    # Xray - 从 api.icmp9.com 下载
    if ! check_cmd xray; then
        _info "安装 Xray..."
        local tmp=$(mktemp -d)

        if ! download_file "${API_BIN}/xray-${bin_arch}.zip" "$tmp/xray.zip"; then
            rm -rf "$tmp"
            _err "下载 Xray 失败"
            return 1
        fi

        unzip -oq "$tmp/xray.zip" -d "$tmp/" || { rm -rf "$tmp"; _err "解压失败"; return 1; }

        install -m 755 "$tmp/xray" /usr/local/bin/xray
        mkdir -p /usr/local/share/xray
        [[ -f "$tmp/geoip.dat" ]] && install -m 644 "$tmp/geoip.dat" /usr/local/share/xray/
        [[ -f "$tmp/geosite.dat" ]] && install -m 644 "$tmp/geosite.dat" /usr/local/share/xray/
        rm -rf "$tmp"

        _ok "Xray 已安装"
    fi

    # tun2socks - 从 api.icmp9.com 下载
    if [[ ! -x "/usr/local/bin/tun2socks" ]]; then
        _info "安装 tun2socks..."
        local tmp=$(mktemp -d)

        if ! download_file "${API_BIN}/tun2socks-${bin_arch}.zip" "$tmp/t2s.zip"; then
            rm -rf "$tmp"
            _err "下载 tun2socks 失败"
            return 1
        fi

        unzip -oq "$tmp/t2s.zip" -d "$tmp/"
        # 查找解压后的二进制文件
        local t2s_bin=$(find "$tmp" -name "tun2socks*" -type f | head -1)
        if [[ -n "$t2s_bin" ]]; then
            mv "$t2s_bin" /usr/local/bin/tun2socks
            chmod +x /usr/local/bin/tun2socks
        fi
        rm -rf "$tmp"

        _ok "tun2socks 已安装"
    fi

    _ok "依赖就绪"
    return 0
}

# Debian/Ubuntu 依赖安装
install_deps_debian() {
    local need_install=()
    check_cmd curl  || need_install+=(curl)
    check_cmd jq    || need_install+=(jq)
    check_cmd unzip || need_install+=(unzip)
    check_cmd ip    || need_install+=(iproute2)
    check_cmd file  || need_install+=(file)

    if [[ ${#need_install[@]} -gt 0 ]]; then
        _info "安装: ${need_install[*]}"
        apt-get update -qq &>/dev/null
        apt-get install -y -qq "${need_install[@]}" &>/dev/null || {
            _err "依赖安装失败"; return 1
        }
    fi

    # 获取系统架构
    local arch=$(uname -m)
    local bin_arch
    case $arch in
        x86_64)  bin_arch="amd64" ;;
        aarch64) bin_arch="arm64" ;;
        armv7l)  bin_arch="armv7" ;;
        *) _err "不支持的架构: $arch"; return 1 ;;
    esac

    # Xray - 从 api.icmp9.com 下载
    if ! check_cmd xray; then
        _info "安装 Xray..."
        local tmp=$(mktemp -d)

        if ! download_file "${API_BIN}/xray-${bin_arch}.zip" "$tmp/xray.zip"; then
            rm -rf "$tmp"
            _err "下载 Xray 失败"
            return 1
        fi

        unzip -oq "$tmp/xray.zip" -d "$tmp/" || { rm -rf "$tmp"; _err "解压失败"; return 1; }

        install -m 755 "$tmp/xray" /usr/local/bin/xray
        mkdir -p /usr/local/share/xray
        [[ -f "$tmp/geoip.dat" ]] && install -m 644 "$tmp/geoip.dat" /usr/local/share/xray/
        [[ -f "$tmp/geosite.dat" ]] && install -m 644 "$tmp/geosite.dat" /usr/local/share/xray/
        rm -rf "$tmp"

        _ok "Xray 已安装"
    fi

    # tun2socks - 从 api.icmp9.com 下载
    if [[ ! -x "/usr/local/bin/tun2socks" ]]; then
        _info "安装 tun2socks..."
        local tmp=$(mktemp -d)

        if ! download_file "${API_BIN}/tun2socks-${bin_arch}.zip" "$tmp/t2s.zip"; then
            rm -rf "$tmp"
            _err "下载 tun2socks 失败"
            return 1
        fi

        unzip -oq "$tmp/t2s.zip" -d "$tmp/"
        # 查找解压后的二进制文件
        local t2s_bin=$(find "$tmp" -name "tun2socks*" -type f | head -1)
        if [[ -n "$t2s_bin" ]]; then
            mv "$t2s_bin" /usr/local/bin/tun2socks
            chmod +x /usr/local/bin/tun2socks
        fi
        rm -rf "$tmp"

        _ok "tun2socks 已安装"
    fi

    _ok "依赖就绪"
    return 0
}

#═══════════════════════════════════════════════════════════════════════════════
# 配置获取
#═══════════════════════════════════════════════════════════════════════════════

fetch_config() {
    local raw=$(fetch_url "$API_CONFIG")
    [[ -z "$raw" ]] && { _err "获取服务器配置失败"; return 1; }

    VMESS_HOST=$(echo "$raw" | grep "^host|" | cut -d'|' -f2 | tr -d '\r\n')
    VMESS_PORT=$(echo "$raw" | grep "^port|" | cut -d'|' -f2 | tr -d '\r\n')
    VMESS_TLS=$(echo "$raw" | grep "^tls|" | cut -d'|' -f2 | tr -d '\r\n')
    VMESS_WSHOST=$(echo "$raw" | grep "^wshost|" | cut -d'|' -f2 | tr -d '\r\n')
    VMESS_WS=$(echo "$raw" | grep "^ws|" | cut -d'|' -f2 | tr -d '\r\n')

    [[ -z "$VMESS_WSHOST" || -z "$VMESS_PORT" ]] && { _err "配置解析失败"; return 1; }
    return 0
}

fetch_nodes() {
    local data=$(fetch_url "$API_NODES")
    [[ -z "$data" ]] && return 1
    echo "$data" | jq -r '.countries[]? | "\(.code)|\(.name)|\(.emoji)"' 2>/dev/null
}

#═══════════════════════════════════════════════════════════════════════════════
# Xray 配置生成
#═══════════════════════════════════════════════════════════════════════════════

generate_xray_config() {
    local uuid=$1 country=$2
    local mode=$(get_mode)
    local security="none"
    local tls_block=""

    [[ "$VMESS_TLS" == "1" ]] && {
        security="tls"
        tls_block='"tlsSettings": {"serverName": "'$VMESS_WSHOST'", "allowInsecure": false},'
    }

    # 入站配置
    local inbounds='[{
        "tag": "socks-in",
        "port": '$SOCKS_PORT',
        "listen": "127.0.0.1",
        "protocol": "socks",
        "settings": {"udp": true}
    }'

    # 全局模式添加透明代理入站
    if [[ "$mode" == "global" ]]; then
        inbounds+=',{
        "tag": "redir-in",
        "port": '$REDIR_PORT',
        "listen": "0.0.0.0",
        "protocol": "dokodemo-door",
        "settings": {"network": "tcp", "followRedirect": true},
        "sniffing": {"enabled": true, "destOverride": ["http", "tls"]}
    }'
    fi
    inbounds+=']'

    cat > "$CONFIG_FILE" << EOF
{
    "log": {"loglevel": "warning"},
    "dns": {
        "servers": [
            "2001:4860:4860::8888",
            "2606:4700:4700::1111",
            "8.8.8.8",
            "1.1.1.1"
        ],
        "queryStrategy": "UseIPv4"
    },
    "inbounds": $inbounds,
    "outbounds": [{
        "tag": "proxy",
        "protocol": "vmess",
        "settings": {
            "vnext": [{
                "address": "$VMESS_WSHOST",
                "port": $VMESS_PORT,
                "users": [{"id": "$uuid", "alterId": 0, "security": "auto"}]
            }]
        },
        "streamSettings": {
            "network": "ws",
            "security": "$security",
            $tls_block
            "wsSettings": {
                "path": "/$country",
                "headers": {"Host": "$VMESS_WSHOST"}
            }
        }
    },{
        "tag": "direct",
        "protocol": "freedom"
    }],
    "routing": {
        "domainStrategy": "AsIs",
        "rules": [{
            "type": "field",
            "ip": ["geoip:private"],
            "outboundTag": "direct"
        }]
    }
}
EOF
}

#═══════════════════════════════════════════════════════════════════════════════
# 辅助脚本生成 (IPv4 + IPv6)
#═══════════════════════════════════════════════════════════════════════════════

create_helper_scripts() {
    # ==================== TUN 启动 ====================
    cat > "$CONFIG_DIR/tun-up.sh" << 'EOFSCRIPT'
#!/bin/bash
set -e
TUN="other"
CFG="/etc/icmp9"
TUN_IP4="10.0.85.1"
TUN_GW4="10.0.85.2"
TUN_IP6="fd00:85::1"
TUN_GW6="fd00:85::2"

# 确保 TUN 模块已加载
modprobe tun 2>/dev/null || true

# 确保 /dev/net/tun 存在
if [[ ! -c /dev/net/tun ]]; then
    mkdir -p /dev/net
    mknod /dev/net/tun c 10 200 2>/dev/null || true
    chmod 666 /dev/net/tun 2>/dev/null || true
fi

# 清理
ip link del $TUN 2>/dev/null || true
sleep 0.3

# 获取路由信息
DEF_GW4=$(ip -4 route show default 2>/dev/null | awk '{print $3; exit}')
DEF_DEV4=$(ip -4 route show default 2>/dev/null | awk '{print $5; exit}')
DEF_GW6=$(ip -6 route show default 2>/dev/null | awk '{print $3; exit}')
DEF_DEV6=$(ip -6 route show default 2>/dev/null | awk '{print $5; exit}')
PROXY_HOST=$(jq -r '.outbounds[0].settings.vnext[0].address' "$CFG/xray.json")

# 解析代理服务器 IP (兼容 Alpine)
resolve_ip4() {
    getent ahostsv4 "$1" 2>/dev/null | awk '{print $1; exit}' || \
    dig +short A "$1" 2>/dev/null | head -1 || \
    nslookup "$1" 2>/dev/null | awk '/^Address: / { print $2; exit }'
}
resolve_ip6() {
    getent ahostsv6 "$1" 2>/dev/null | awk '{print $1; exit}' || \
    dig +short AAAA "$1" 2>/dev/null | head -1
}
PROXY_IP4=$(resolve_ip4 "$PROXY_HOST")
PROXY_IP6=$(resolve_ip6 "$PROXY_HOST")

# 获取当前 SSH 连接的客户端 IP (保持 SSH 不断)
SSH_CLIENT_IP=$(echo $SSH_CONNECTION | awk '{print $1}')

# 保存信息
echo "$DEF_GW4|$DEF_DEV4|$DEF_GW6|$DEF_DEV6|$PROXY_IP4|$PROXY_IP6|$SSH_CLIENT_IP" > "$CFG/route_backup"

# 纯 IPv6 环境：配置 IPv6 DNS
if [[ -z "$DEF_GW4" && -n "$DEF_GW6" ]]; then
    [[ ! -f /etc/resolv.conf.icmp9.bak ]] && cp /etc/resolv.conf /etc/resolv.conf.icmp9.bak
    cat > /etc/resolv.conf << 'DNSEOF'
# ICMP9 IPv6 DNS
nameserver 2001:4860:4860::8888
nameserver 2606:4700:4700::1111
DNSEOF
fi

# 创建 TUN
ip tuntap add mode tun dev $TUN
ip link set dev $TUN up

# IPv4 配置 (即使没有原生 IPv4，也创建 TUN IPv4 让流量走代理)
ip -4 addr add $TUN_IP4/30 dev $TUN
if [[ -n "$DEF_GW4" && -n "$PROXY_IP4" ]]; then
    ip -4 route add $PROXY_IP4 via $DEF_GW4 dev $DEF_DEV4 2>/dev/null || true
fi
ip -4 route add default via $TUN_GW4 dev $TUN metric 1 2>/dev/null || true

# IPv6 配置
if [[ -n "$DEF_GW6" ]]; then
    ip -6 addr add $TUN_IP6/126 dev $TUN

    # 代理服务器直连
    [[ -n "$PROXY_IP6" ]] && ip -6 route add $PROXY_IP6 via $DEF_GW6 dev $DEF_DEV6 2>/dev/null || true

    # SSH 客户端直连 (防止失联)
    if [[ -n "$SSH_CLIENT_IP" && "$SSH_CLIENT_IP" == *:* ]]; then
        ip -6 route add $SSH_CLIENT_IP via $DEF_GW6 dev $DEF_DEV6 2>/dev/null || true
    fi

    # IPv6 DNS 服务器直连
    ip -6 route add 2001:4860:4860::8888 via $DEF_GW6 dev $DEF_DEV6 2>/dev/null || true
    ip -6 route add 2001:4860:4860::8844 via $DEF_GW6 dev $DEF_DEV6 2>/dev/null || true
    ip -6 route add 2606:4700:4700::1111 via $DEF_GW6 dev $DEF_DEV6 2>/dev/null || true
    ip -6 route add 2606:4700:4700::1001 via $DEF_GW6 dev $DEF_DEV6 2>/dev/null || true

    # 不修改 IPv6 默认路由！纯 IPv6 环境只代理 IPv4
    # ip -6 route add default via $TUN_GW6 dev $TUN metric 1
fi

exit 0
EOFSCRIPT

    # ==================== TUN 停止 ====================
    cat > "$CONFIG_DIR/tun-down.sh" << 'EOFSCRIPT'
#!/bin/bash
TUN="other"
CFG="/etc/icmp9"
TUN_GW4="10.0.85.2"
TUN_GW6="fd00:85::2"

if [[ -f "$CFG/route_backup" ]]; then
    IFS='|' read -r DEF_GW4 DEF_DEV4 DEF_GW6 DEF_DEV6 PROXY_IP4 PROXY_IP6 < "$CFG/route_backup"

    # 清理 IPv4
    ip -4 route del default via $TUN_GW4 dev $TUN 2>/dev/null || true
    [[ -n "$PROXY_IP4" ]] && ip -4 route del $PROXY_IP4 2>/dev/null || true

    # 清理 IPv6
    ip -6 route del default via $TUN_GW6 dev $TUN 2>/dev/null || true
    [[ -n "$PROXY_IP6" ]] && ip -6 route del $PROXY_IP6 2>/dev/null || true
    # 清理 DNS 路由
    ip -6 route del 2001:4860:4860::8888 2>/dev/null || true
    ip -6 route del 2001:4860:4860::8844 2>/dev/null || true
    ip -6 route del 2606:4700:4700::1111 2>/dev/null || true
    ip -6 route del 2606:4700:4700::1001 2>/dev/null || true
fi

# 恢复 DNS 配置
[[ -f /etc/resolv.conf.icmp9.bak ]] && mv /etc/resolv.conf.icmp9.bak /etc/resolv.conf

ip link del $TUN 2>/dev/null || true
exit 0
EOFSCRIPT

    # ==================== 全局代理启动 ====================
    cat > "$CONFIG_DIR/global-up.sh" << 'EOFSCRIPT'
#!/bin/bash
CFG="/etc/icmp9"
REDIR_PORT=10809

# 检测网络环境
DEF_GW4=$(ip -4 route show default 2>/dev/null | awk '{print $3; exit}')
DEF_GW6=$(ip -6 route show default 2>/dev/null | awk '{print $3; exit}')

# 纯 IPv6 环境：配置 IPv6 DNS
if [[ -z "$DEF_GW4" && -n "$DEF_GW6" ]]; then
    [[ ! -f /etc/resolv.conf.icmp9.bak ]] && cp /etc/resolv.conf /etc/resolv.conf.icmp9.bak
    cat > /etc/resolv.conf << 'DNSEOF'
# ICMP9 IPv6 DNS
nameserver 2001:4860:4860::8888
nameserver 2606:4700:4700::1111
DNSEOF
fi

PROXY_HOST=$(jq -r '.outbounds[0].settings.vnext[0].address' "$CFG/xray.json")
PROXY_IP4=$(getent ahostsv4 "$PROXY_HOST" 2>/dev/null | awk '{print $1}' | sort -u)
PROXY_IP6=$(getent ahostsv6 "$PROXY_HOST" 2>/dev/null | awk '{print $1}' | sort -u)

# ===== IPv4 =====
iptables -t nat -D OUTPUT -p tcp -j ICMP9 2>/dev/null
iptables -t nat -F ICMP9 2>/dev/null
iptables -t nat -X ICMP9 2>/dev/null
iptables -t nat -N ICMP9

# 排除地址
iptables -t nat -A ICMP9 -d 127.0.0.0/8 -j RETURN
iptables -t nat -A ICMP9 -d 10.0.0.0/8 -j RETURN
iptables -t nat -A ICMP9 -d 172.16.0.0/12 -j RETURN
iptables -t nat -A ICMP9 -d 192.168.0.0/16 -j RETURN
iptables -t nat -A ICMP9 -d 100.64.0.0/10 -j RETURN
iptables -t nat -A ICMP9 -d 169.254.0.0/16 -j RETURN
iptables -t nat -A ICMP9 -d 224.0.0.0/4 -j RETURN
iptables -t nat -A ICMP9 -d 240.0.0.0/4 -j RETURN

for ip in $PROXY_IP4; do
    iptables -t nat -A ICMP9 -d "$ip" -j RETURN
done

iptables -t nat -A ICMP9 -p tcp -j REDIRECT --to-ports $REDIR_PORT
iptables -t nat -A OUTPUT -p tcp -j ICMP9

# ===== IPv6 =====
if command -v ip6tables &>/dev/null; then
    ip6tables -t nat -D OUTPUT -p tcp -j ICMP9_V6 2>/dev/null
    ip6tables -t nat -F ICMP9_V6 2>/dev/null
    ip6tables -t nat -X ICMP9_V6 2>/dev/null
    ip6tables -t nat -N ICMP9_V6

    # 排除 IPv6 DNS 服务器
    ip6tables -t nat -A ICMP9_V6 -d 2001:4860:4860::8888/128 -j RETURN
    ip6tables -t nat -A ICMP9_V6 -d 2001:4860:4860::8844/128 -j RETURN
    ip6tables -t nat -A ICMP9_V6 -d 2606:4700:4700::1111/128 -j RETURN
    ip6tables -t nat -A ICMP9_V6 -d 2606:4700:4700::1001/128 -j RETURN

    ip6tables -t nat -A ICMP9_V6 -d ::1/128 -j RETURN
    ip6tables -t nat -A ICMP9_V6 -d fc00::/7 -j RETURN
    ip6tables -t nat -A ICMP9_V6 -d fe80::/10 -j RETURN
    ip6tables -t nat -A ICMP9_V6 -d ff00::/8 -j RETURN

    for ip in $PROXY_IP6; do
        ip6tables -t nat -A ICMP9_V6 -d "$ip" -j RETURN
    done

    ip6tables -t nat -A ICMP9_V6 -p tcp -j REDIRECT --to-ports $REDIR_PORT
    ip6tables -t nat -A OUTPUT -p tcp -j ICMP9_V6
fi

exit 0
EOFSCRIPT

    # ==================== 全局代理停止 ====================
    cat > "$CONFIG_DIR/global-down.sh" << 'EOFSCRIPT'
#!/bin/bash
# IPv4
iptables -t nat -D OUTPUT -p tcp -j ICMP9 2>/dev/null
iptables -t nat -F ICMP9 2>/dev/null
iptables -t nat -X ICMP9 2>/dev/null

# IPv6
if command -v ip6tables &>/dev/null; then
    ip6tables -t nat -D OUTPUT -p tcp -j ICMP9_V6 2>/dev/null
    ip6tables -t nat -F ICMP9_V6 2>/dev/null
    ip6tables -t nat -X ICMP9_V6 2>/dev/null
fi

# 恢复 DNS 配置
[[ -f /etc/resolv.conf.icmp9.bak ]] && mv /etc/resolv.conf.icmp9.bak /etc/resolv.conf

exit 0
EOFSCRIPT

    chmod +x "$CONFIG_DIR"/*.sh
}

#═══════════════════════════════════════════════════════════════════════════════
# 服务创建 (区分 Alpine OpenRC 和 Debian systemd)
#═══════════════════════════════════════════════════════════════════════════════

create_services() {
    if [[ "$DISTRO" == "alpine" ]]; then
        create_services_openrc
    else
        create_services_systemd
    fi
}

# Alpine Linux OpenRC 服务
create_services_openrc() {
    local mode=$(get_mode)

    # Xray 服务
    cat > /etc/init.d/icmp9-xray << 'EOF'
#!/sbin/openrc-run

name="ICMP9 Xray"
description="ICMP9 Xray Proxy Service"
command="/usr/local/bin/xray"
command_args="run -c /etc/icmp9/xray.json"
command_background="yes"
pidfile="/run/icmp9-xray.pid"
output_log="/var/log/icmp9-xray.log"
error_log="/var/log/icmp9-xray.log"

depend() {
    need net
    after firewall
}

start_pre() {
    checkpath --directory --owner root:root --mode 0755 /run
}
EOF
    chmod +x /etc/init.d/icmp9-xray

    if [[ "$mode" == "tun" ]]; then
        # TUN 服务
        cat > /etc/init.d/icmp9-tun << 'EOF'
#!/sbin/openrc-run

name="ICMP9 TUN"
description="ICMP9 TUN Proxy Service"
command="/usr/local/bin/tun2socks"
command_args="-device other -proxy socks5://127.0.0.1:10808 -loglevel silent"
command_background="yes"
pidfile="/run/icmp9-tun.pid"
output_log="/var/log/icmp9-tun.log"
error_log="/var/log/icmp9-tun.log"

depend() {
    need net icmp9-xray
}

start_pre() {
    # 加载 TUN 模块
    modprobe tun 2>/dev/null || true

    # 确保 /dev/net/tun 存在
    if [ ! -c /dev/net/tun ]; then
        mkdir -p /dev/net
        mknod /dev/net/tun c 10 200 2>/dev/null || true
        chmod 666 /dev/net/tun 2>/dev/null || true
    fi

    # 执行 TUN 配置脚本
    /etc/icmp9/tun-up.sh || {
        eerror "TUN setup failed"
        return 1
    }
}

stop_post() {
    /etc/icmp9/tun-down.sh
}
EOF
        chmod +x /etc/init.d/icmp9-tun
        rm -f /etc/init.d/icmp9-global
    else
        # 全局代理服务
        cat > /etc/init.d/icmp9-global << 'EOF'
#!/sbin/openrc-run

name="ICMP9 Global Proxy"
description="ICMP9 Global iptables Proxy"

depend() {
    need net icmp9-xray
}

start() {
    ebegin "Starting ICMP9 Global Proxy"
    /etc/icmp9/global-up.sh
    eend $?
}

stop() {
    ebegin "Stopping ICMP9 Global Proxy"
    /etc/icmp9/global-down.sh
    eend $?
}
EOF
        chmod +x /etc/init.d/icmp9-global
        rm -f /etc/init.d/icmp9-tun
    fi
}

# Debian/Ubuntu systemd 服务
create_services_systemd() {
    local mode=$(get_mode)

    cat > /etc/systemd/system/icmp9-xray.service << EOF
[Unit]
Description=ICMP9 Xray Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/xray run -c $CONFIG_FILE
Restart=on-failure
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

    if [[ "$mode" == "tun" ]]; then
        cat > /etc/systemd/system/icmp9-tun.service << EOF
[Unit]
Description=ICMP9 TUN Service
After=network-online.target icmp9-xray.service
Wants=network-online.target
Requires=icmp9-xray.service

[Service]
Type=simple
ExecStartPre=$CONFIG_DIR/tun-up.sh
ExecStart=/usr/local/bin/tun2socks -device $TUN_NAME -proxy socks5://127.0.0.1:$SOCKS_PORT -loglevel silent
ExecStopPost=$CONFIG_DIR/tun-down.sh
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
        rm -f /etc/systemd/system/icmp9-global.service
    else
        cat > /etc/systemd/system/icmp9-global.service << EOF
[Unit]
Description=ICMP9 Global Proxy
After=network-online.target icmp9-xray.service
Wants=network-online.target
Requires=icmp9-xray.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$CONFIG_DIR/global-up.sh
ExecStop=$CONFIG_DIR/global-down.sh

[Install]
WantedBy=multi-user.target
EOF
        rm -f /etc/systemd/system/icmp9-tun.service
    fi

    systemctl daemon-reload
}

#═══════════════════════════════════════════════════════════════════════════════
# 服务控制 (兼容 Alpine 和 Debian)
#═══════════════════════════════════════════════════════════════════════════════

# 服务状态检查
service_is_active() {
    local svc=$1
    if [[ "$DISTRO" == "alpine" ]]; then
        rc-service "$svc" status &>/dev/null
    else
        systemctl is-active --quiet "$svc"
    fi
}

# 启动服务
service_start() {
    local svc=$1
    if [[ "$DISTRO" == "alpine" ]]; then
        rc-service "$svc" start &>/dev/null
    else
        systemctl start "$svc" &>/dev/null
    fi
}

# 停止服务
service_stop() {
    local svc=$1
    if [[ "$DISTRO" == "alpine" ]]; then
        rc-service "$svc" stop &>/dev/null
    else
        systemctl stop "$svc" &>/dev/null
    fi
}

# 启用开机自启
service_enable() {
    local svc=$1
    if [[ "$DISTRO" == "alpine" ]]; then
        rc-update add "$svc" default &>/dev/null
    else
        systemctl enable "$svc" &>/dev/null
    fi
}

# 禁用开机自启
service_disable() {
    local svc=$1
    if [[ "$DISTRO" == "alpine" ]]; then
        rc-update del "$svc" default &>/dev/null
    else
        systemctl disable "$svc" &>/dev/null
    fi
}

# 重启服务
service_restart() {
    local svc=$1
    if [[ "$DISTRO" == "alpine" ]]; then
        rc-service "$svc" restart &>/dev/null
    else
        systemctl restart "$svc" &>/dev/null
    fi
}

# 自动诊断和修复
auto_diagnose() {
    local issue_found=0

    # 检查配置文件
    if [[ -f "$CONFIG_FILE" ]]; then
        if ! jq empty "$CONFIG_FILE" &>/dev/null; then
            _warn "配置文件损坏，尝试修复..."
            local uuid=$(get_uuid)
            local country=$(get_country)
            if [[ -n "$uuid" && -n "$country" ]]; then
                fetch_config && generate_xray_config "$uuid" "$country"
                _ok "配置文件已修复"
                issue_found=1
            fi
        fi
    fi

    # 检查 TUN 设备残留
    if ip link show $TUN_NAME &>/dev/null; then
        if ! service_is_active icmp9-tun; then
            _warn "发现残留 TUN 设备，清理中..."
            ip link del $TUN_NAME &>/dev/null
            issue_found=1
        fi
    fi

    # 检查 iptables 残留
    if iptables -t nat -L ICMP9 &>/dev/null; then
        if ! service_is_active icmp9-global; then
            _warn "发现残留 iptables 规则，清理中..."
            "$CONFIG_DIR/global-down.sh" &>/dev/null
            issue_found=1
        fi
    fi

    # 检查端口占用
    if ss -tlnp 2>/dev/null | grep -q ":$SOCKS_PORT "; then
        if ! service_is_active icmp9-xray; then
            _warn "端口 $SOCKS_PORT 被占用，尝试释放..."
            fuser -k $SOCKS_PORT/tcp &>/dev/null 2>&1 || true
            issue_found=1
        fi
    fi

    return $issue_found
}

# 带重试的服务启动
start_services() {
    local mode=$(get_mode)
    local max_retry=3
    local retry=0

    rm -f "$PAUSE_FILE"

    # 启动前诊断
    auto_diagnose

    # 启动 Xray（带重试）
    service_enable icmp9-xray
    while [[ $retry -lt $max_retry ]]; do
        if service_start icmp9-xray; then
            break
        fi
        ((retry++))
        _warn "Xray 启动失败，重试 $retry/$max_retry..."
        sleep 2
        # 尝试修复
        auto_diagnose
    done

    if ! service_is_active icmp9-xray; then
        _err "Xray 启动失败"
        if [[ "$DISTRO" == "alpine" ]]; then
            _info "尝试查看日志: cat /var/log/icmp9-xray.log"
        else
            _info "尝试查看日志: journalctl -u icmp9-xray -n 10"
        fi
        return 1
    fi

    sleep 1

    # 启动代理服务（带重试）
    retry=0
    if [[ "$mode" == "tun" ]]; then
        service_enable icmp9-tun
        while [[ $retry -lt $max_retry ]]; do
            if service_start icmp9-tun; then
                break
            fi
            ((retry++))
            _warn "TUN 启动失败，重试 $retry/$max_retry..."
            ip link del $TUN_NAME &>/dev/null
            sleep 2
        done

        if ! service_is_active icmp9-tun; then
            _err "TUN 服务启动失败"
            return 1
        fi
    else
        service_enable icmp9-global
        while [[ $retry -lt $max_retry ]]; do
            if service_start icmp9-global; then
                break
            fi
            ((retry++))
            _warn "全局代理启动失败，重试 $retry/$max_retry..."
            "$CONFIG_DIR/global-down.sh" &>/dev/null
            sleep 2
        done

        # 对于 Alpine OpenRC oneshot 类型服务，检查方式不同
        if [[ "$DISTRO" != "alpine" ]] && ! service_is_active icmp9-global; then
            _err "全局代理启动失败"
            return 1
        fi
    fi

    return 0
}

stop_services() {
    service_stop icmp9-tun
    service_stop icmp9-global
    service_stop icmp9-xray
    ip link del $TUN_NAME &>/dev/null || true
    "$CONFIG_DIR/global-down.sh" &>/dev/null || true
}

pause_services() {
    _info "暂停服务..."
    stop_services
    touch "$PAUSE_FILE"
    _ok "服务已暂停"
}

resume_services() {
    _info "恢复服务..."
    if start_services; then
        _ok "服务已恢复"
        return 0
    fi
    return 1
}

restart_services() {
    _info "重启服务..."
    stop_services
    sleep 1
    start_services && _ok "重启完成"
}

#═══════════════════════════════════════════════════════════════════════════════
# 连接测试
#═══════════════════════════════════════════════════════════════════════════════

test_connection() {
    local mode=$(get_mode)
    local result=""
    local retry=0
    local max_retry=2

    _info "测试连接..."

    while [[ $retry -lt $max_retry ]]; do
        if [[ "$mode" == "tun" ]]; then
            if ip link show $TUN_NAME &>/dev/null; then
                result=$(curl --interface $TUN_NAME -sf -m 10 http://ip.sb 2>/dev/null)
            else
                _warn "网卡 $TUN_NAME 不存在，尝试修复..."
                restart_services
                ((retry++))
                continue
            fi
        else
            result=$(curl -sf -m 10 http://ip.sb 2>/dev/null)
        fi

        if [[ -n "$result" ]]; then
            _ok "连接成功  IP: ${G}$result${NC}"
            return 0
        fi

        ((retry++))
        if [[ $retry -lt $max_retry ]]; then
            _warn "连接失败，诊断中..."
            diagnose_connection
        fi
    done

    _err "连接失败"
    return 1
}

# 连接诊断
diagnose_connection() {
    local mode=$(get_mode)

    # 检查服务状态
    if ! service_is_active icmp9-xray; then
        _warn "Xray 未运行，尝试启动..."
        service_start icmp9-xray
        sleep 2
    fi

    if [[ "$mode" == "tun" ]]; then
        if ! service_is_active icmp9-tun; then
            _warn "TUN 服务未运行，尝试启动..."
            ip link del $TUN_NAME &>/dev/null
            service_start icmp9-tun
            sleep 2
        fi

        # 检查路由
        if ! ip route | grep -q "via $TUN_GW4 dev $TUN_NAME"; then
            _warn "路由异常，尝试修复..."
            service_restart icmp9-tun
            sleep 2
        fi
    else
        if ! service_is_active icmp9-global 2>/dev/null; then
            _warn "全局代理未运行，尝试启动..."
            service_start icmp9-global
            sleep 2
        fi

        # 检查 iptables
        if ! iptables -t nat -L ICMP9 &>/dev/null; then
            _warn "iptables 规则缺失，尝试修复..."
            "$CONFIG_DIR/global-up.sh"
        fi
    fi

    # 检查 DNS
    if ! host -W 3 ip.sb &>/dev/null 2>&1; then
        _warn "DNS 解析异常"
    fi
}

#═══════════════════════════════════════════════════════════════════════════════
# 安装流程
#═══════════════════════════════════════════════════════════════════════════════

do_install() {
    if check_installed; then
        _warn "已安装，请先卸载"
        return
    fi

    _header
    echo ""
    _title "              ── 安装向导 ──"
    echo ""
    echo -e "  ${D}系统检测:${NC} ${C}$DISTRO${NC}"

    # 检测网络
    local has_ipv4=0 has_ipv6=0
    curl -4 -sf --connect-timeout 3 ip.sb &>/dev/null && has_ipv4=1
    curl -6 -sf --connect-timeout 3 ip.sb &>/dev/null && has_ipv6=1
    echo -e "  ${D}网络检测:${NC} IPv4 $([ $has_ipv4 -eq 1 ] && echo -e "${G}✓${NC}" || echo -e "${R}✗${NC}")  IPv6 $([ $has_ipv6 -eq 1 ] && echo -e "${G}✓${NC}" || echo -e "${R}✗${NC}")"
    echo ""

    # 纯 IPv6 环境强制使用 TUN 模式
    local proxy_mode
    if [[ $has_ipv4 -eq 0 && $has_ipv6 -eq 1 ]]; then
        _warn "纯 IPv6 环境，自动选择 TUN 模式"
        proxy_mode="tun"
        sleep 1
    else
        # 选择模式
        _line
        echo -e "  ${C}选择代理模式${NC}"
        _line
        _item "1" "TUN 网卡模式  (创建 $TUN_NAME 虚拟网卡)"
        _item "2" "全局代理模式  (iptables 透明代理)"
        echo ""

        local mode_choice
        while true; do
            read -rp "  请选择 [1-2]: " mode_choice
            case $mode_choice in
                1) proxy_mode="tun"; break ;;
                2) proxy_mode="global"; break ;;
                *) _err "无效选择" ;;
            esac
        done
    fi

    echo ""
    _line
    echo -e "  ${C}输入认证信息${NC}"
    _line

    local uuid
    while true; do
        read -rp "  KEY: " uuid
        [[ "$uuid" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] && break
        _err "KEY 格式错误"
    done

    echo ""
    install_deps || return

    _info "获取服务器配置..."
    fetch_config || return

    _info "获取节点列表..."
    local nodes=$(fetch_nodes)
    [[ -z "$nodes" ]] && { _err "获取节点失败"; return; }

    echo ""
    _line
    echo -e "  ${C}选择接入节点${NC}"
    _line

    local i=1
    declare -A node_map
    while IFS='|' read -r code name emoji; do
        printf "  ${G}%2d${NC}) %s %s\n" "$i" "$emoji" "$name"
        node_map[$i]=$code
        ((i++))
    done <<< "$nodes"

    echo ""
    local max=$((i-1)) choice
    while true; do
        read -rp "  选择 [1-$max]: " choice
        [[ "$choice" =~ ^[0-9]+$ && -n "${node_map[$choice]}" ]] && break
        _err "无效选择"
    done

    local country=${node_map[$choice]}

    echo ""
    _info "配置服务..."

    mkdir -p "$CONFIG_DIR"
    echo "$uuid" > "$UUID_FILE"
    echo "$country" > "$STATE_FILE"
    echo "$proxy_mode" > "$MODE_FILE"

    generate_xray_config "$uuid" "$country"
    create_helper_scripts
    create_services

    _info "启动服务..."
    if start_services; then
        echo ""
        _line
        _ok "安装完成!"
        echo -e "  模式: ${G}$([ "$proxy_mode" == "tun" ] && echo "TUN网卡" || echo "全局代理")${NC}"
        echo -e "  节点: ${G}$country${NC}"
        [[ "$proxy_mode" == "tun" ]] && echo -e "  网卡: ${G}$TUN_NAME${NC}"
        _line
        sleep 2
        test_connection
    else
        _err "安装失败"
    fi
}

#═══════════════════════════════════════════════════════════════════════════════
# 切换节点
#═══════════════════════════════════════════════════════════════════════════════

do_switch_node() {
    check_installed || { _err "请先安装"; return; }

    local current=$(get_country)
    _header
    echo ""
    _title "              ── 切换节点 ──"
    echo -e "  当前: ${G}$current${NC}"
    echo ""

    _info "获取配置..."
    fetch_config || return

    _info "获取节点..."
    local nodes=$(fetch_nodes)
    [[ -z "$nodes" ]] && { _err "获取失败"; return; }

    echo ""
    _line

    local i=1
    declare -A node_map
    while IFS='|' read -r code name emoji; do
        local mark=""
        [[ "$code" == "$current" ]] && mark=" ${Y}◀${NC}"
        printf "  ${G}%2d${NC}) %s %s%b\n" "$i" "$emoji" "$name" "$mark"
        node_map[$i]=$code
        ((i++))
    done <<< "$nodes"

    echo ""
    local max=$((i-1)) choice
    while true; do
        read -rp "  选择 [1-$max]: " choice
        [[ "$choice" =~ ^[0-9]+$ && -n "${node_map[$choice]}" ]] && break
        _err "无效选择"
    done

    local country=${node_map[$choice]}
    [[ "$country" == "$current" ]] && { _warn "已是当前节点"; return; }

    _info "切换到 $country..."
    generate_xray_config "$(get_uuid)" "$country"
    echo "$country" > "$STATE_FILE"

    restart_services && test_connection
}

#═══════════════════════════════════════════════════════════════════════════════
# 切换模式
#═══════════════════════════════════════════════════════════════════════════════

do_switch_mode() {
    check_installed || { _err "请先安装"; return; }

    local current=$(get_mode)
    _header
    echo ""
    _title "              ── 切换模式 ──"
    echo -e "  当前: ${G}$([ "$current" == "tun" ] && echo "TUN网卡" || echo "全局代理")${NC}"
    echo ""
    _line
    _item "1" "TUN 网卡"
    _item "2" "全局代理"
    echo ""

    local choice new_mode
    while true; do
        read -rp "  选择 [1-2]: " choice
        case $choice in
            1) new_mode="tun"; break ;;
            2) new_mode="global"; break ;;
            *) _err "无效选择" ;;
        esac
    done

    [[ "$new_mode" == "$current" ]] && { _warn "已是当前模式"; return; }

    _info "切换模式..."
    stop_services
    echo "$new_mode" > "$MODE_FILE"

    fetch_config || { _err "获取配置失败"; return; }
    generate_xray_config "$(get_uuid)" "$(get_country)"
    create_helper_scripts
    create_services

    start_services && { _ok "模式切换完成"; test_connection; }
}

#═══════════════════════════════════════════════════════════════════════════════
# 卸载
#═══════════════════════════════════════════════════════════════════════════════

do_uninstall() {
    check_installed || { _warn "未安装"; return; }

    echo ""
    echo -e "  ${Y}确认卸载？[y/N]${NC}"
    read -r confirm
    [[ "$confirm" != "y" && "$confirm" != "Y" ]] && return

    _info "停止服务..."
    stop_services

    _info "删除服务..."
    if [[ "$DISTRO" == "alpine" ]]; then
        service_disable icmp9-xray
        service_disable icmp9-tun
        service_disable icmp9-global
        rm -f /etc/init.d/icmp9-xray
        rm -f /etc/init.d/icmp9-tun
        rm -f /etc/init.d/icmp9-global
    else
        systemctl disable icmp9-xray icmp9-tun icmp9-global &>/dev/null
        rm -f /etc/systemd/system/icmp9-*.service
        systemctl daemon-reload
    fi

    _info "清理配置..."
    rm -rf "$CONFIG_DIR"

    _ok "卸载完成"
}

#═══════════════════════════════════════════════════════════════════════════════
# 状态显示
#═══════════════════════════════════════════════════════════════════════════════

show_status() {
    if check_installed; then
        local mode=$(get_mode)
        local country=$(get_country)
        local paused=$(is_paused && echo "1" || echo "0")
        local xray_st=$(service_is_active icmp9-xray && echo "active" || echo "inactive")
        local proxy_st
        if [[ "$mode" == "tun" ]]; then
            proxy_st=$(service_is_active icmp9-tun && echo "active" || echo "inactive")
        else
            # 对于 Alpine 的 oneshot 服务，检查 iptables 规则
            if [[ "$DISTRO" == "alpine" ]]; then
                proxy_st=$(iptables -t nat -L ICMP9 &>/dev/null && echo "active" || echo "inactive")
            else
                proxy_st=$(service_is_active icmp9-global && echo "active" || echo "inactive")
            fi
        fi

        # 状态行
        local status_icon status_text
        if [[ "$paused" == "1" ]]; then
            status_icon="${Y}⏸${NC}"; status_text="${Y}已暂停${NC}"
        elif [[ "$xray_st" == "active" && "$proxy_st" == "active" ]]; then
            status_icon="${G}●${NC}"; status_text="${G}运行中${NC}"
        else
            status_icon="${R}●${NC}"; status_text="${R}已停止${NC}"
        fi

        echo -e "  状态: $status_icon $status_text"
        echo -e "  模式: ${C}$([ "$mode" == "tun" ] && echo "TUN ($TUN_NAME)" || echo "全局代理")${NC}"
        echo -e "  节点: ${C}$country${NC}"

        # 详细状态
        echo ""
        printf "  Xray:   "; [[ "$xray_st" == "active" ]] && echo -e "${G}运行${NC}" || echo -e "${R}停止${NC}"

        if [[ "$mode" == "tun" ]]; then
            printf "  TUN:    "; [[ "$proxy_st" == "active" ]] && echo -e "${G}运行${NC}" || echo -e "${R}停止${NC}"
            printf "  网卡:   "; ip link show $TUN_NAME &>/dev/null && echo -e "${G}已创建${NC}" || echo -e "${R}未创建${NC}"
        else
            printf "  代理:   "; [[ "$proxy_st" == "active" ]] && echo -e "${G}运行${NC}" || echo -e "${R}停止${NC}"
        fi
    else
        echo -e "  状态: ${D}○${NC} ${D}未安装${NC}"
    fi
}

#═══════════════════════════════════════════════════════════════════════════════
# 主菜单
#═══════════════════════════════════════════════════════════════════════════════

main_menu() {
    check_root

    while true; do
        _header
        echo ""
        show_status
        echo ""
        _line

        if check_installed; then
            _item "1" "切换节点"
            _item "2" "切换模式"
            if is_paused; then
                _item "3" "恢复服务"
            else
                _item "3" "暂停服务"
            fi
            _item "4" "重启服务"
            _item "5" "测试连接"
            _item "6" "卸载服务"
        else
            _item "1" "安装服务"
        fi
        _item "0" "退出"
        _line

        local choice
        read -rp "  请选择: " choice

        if check_installed; then
            case $choice in
                1) do_switch_node ;;
                2) do_switch_mode ;;
                3) is_paused && resume_services || pause_services ;;
                4) restart_services ;;
                5) test_connection ;;
                6) do_uninstall ;;
                0) exit 0 ;;
                *) _err "无效选择" ;;
            esac
        else
            case $choice in
                1) do_install ;;
                0) exit 0 ;;
                *) _err "无效选择" ;;
            esac
        fi

        _pause
    done
}

main_menu
