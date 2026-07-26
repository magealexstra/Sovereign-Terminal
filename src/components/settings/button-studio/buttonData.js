// Static button data — extracted from ButtonStudio.jsx to keep the component
// focused on UI logic only. Add new prebuilt categories or default buttons here.

// Default buttons loaded when no localStorage save exists
export const DEFAULT_BUTTONS = [
  { id: 'b1', label: 'ESC',       value: '\x1b',      width: 2.4, height: 2.0, shape: 'rounded', bg: '#141E26', text: '#E6EDF0', border: '#5E81AC' },
  { id: 'b2', label: 'TAB',       value: '\t',        width: 2.4, height: 2.0, shape: 'rounded', bg: '#141E26', text: '#E6EDF0', border: '#5E81AC' },
  { id: 'b3', label: '^C',        value: '\x03',      width: 2.4, height: 2.0, shape: 'rounded', bg: '#141E26', text: '#E6EDF0', border: '#5E81AC' },
  { id: 'b4', label: 'htop',      value: 'htop\n',    width: 3.2, height: 2.0, shape: 'pill',    bg: '#141E26', text: '#5E81AC', border: '#4C7864' },
  { id: 'b5', label: 'docker ps', value: 'docker ps\n', width: 4.2, height: 2.0, shape: 'rounded', bg: '#21252b', text: '#88C0D0', border: '#fcee0a' },
];

// Built-in categorized command preset bundles
export const PREBUILT_CATEGORIES = {
  AGY: { name: 'Anti-Gravity CLI - AGY', items: [
    { label: '/model',    value: '/model ' },
    { label: '/clear',    value: '/clear\n' },
    { label: '/plan',     value: '/plan ' },
    { label: '/schedule', value: '/schedule ' },
    { label: '/goal',     value: '/goal ' },
    { label: '/grill-me', value: '/grill-me ' },
    { label: '/teamwork', value: '/teamwork-preview ' },
    { label: '/learn',    value: '/learn ' },
    { label: 'Ctrl+O',   value: '\x0f' }
  ]},
  APT: { name: 'APT Package Manager - APT', items: [
    { label: 'upgrade -y', value: 'sudo apt update && sudo apt upgrade -y\n' },
    { label: 'apt update',  value: 'sudo apt update\n' },
    { label: 'apt search',  value: 'sudo apt search ' },
    { label: 'apt install', value: 'sudo apt install ' },
    { label: 'apt purge',   value: 'sudo apt purge ' },
    { label: 'autoremove',  value: 'sudo apt autoremove -y\n' },
    { label: 'apt clean',   value: 'sudo apt clean\n' },
    { label: 'dpkg -l',     value: 'dpkg -l\n' }
  ]},
  CLD: { name: 'Claude CLI - CLD', items: [
    { label: '/compact', value: '/compact\n' },
    { label: '/cost',    value: '/cost\n' },
    { label: '/doctor',  value: '/doctor\n' },
    { label: '/clear',   value: '/clear\n' },
    { label: '/help',    value: '/help\n' },
    { label: '/init',    value: '/init\n' },
    { label: '/bug',     value: '/bug ' },
    { label: '/review',  value: '/review ' },
    { label: 'Ctrl+C',  value: '\x03' }
  ]},
  DOC: { name: 'Docker Suite - DOC', items: [
    { label: 'docker ps',    value: 'docker ps\n' },
    { label: 'docker ps -a', value: 'docker ps -a\n' },
    { label: 'compose up',   value: 'docker compose up -d\n' },
    { label: 'compose down', value: 'docker compose down\n' },
    { label: 'compose logs', value: 'docker compose logs -f\n' },
    { label: 'docker exec',  value: 'docker exec -it ' },
    { label: 'prune -f',     value: 'docker system prune -f\n' },
    { label: 'docker images', value: 'docker images\n' }
  ]},
  FILE: { name: 'Files & Permissions - FILE', items: [
    { label: 'chmod +x',  value: 'chmod +x ' },
    { label: 'chmod 755', value: 'chmod 755 ' },
    { label: 'chmod 644', value: 'chmod 644 ' },
    { label: 'chown -R',  value: 'sudo chown -R ' },
    { label: 'chgrp -R',  value: 'sudo chgrp -R ' },
    { label: 'mkdir -p',  value: 'mkdir -p ' },
    { label: 'find . -name', value: 'find . -name ' },
    { label: 'rsync -avz', value: 'rsync -avz ' },
    { label: 'tar -czvf', value: 'tar -czvf ' },
    { label: 'tar -xvf',  value: 'tar -xvf ' },
    { label: 'unzip',     value: 'unzip ' }
  ]},
  GIT: { name: 'Git Version Control - GIT', items: [
    { label: 'git status',   value: 'git status\n' },
    { label: 'git log -10',  value: 'git log --oneline -n 10\n' },
    { label: 'git add .',    value: 'git add .\n' },
    { label: 'git commit',   value: 'git commit -m "' },
    { label: 'git push',     value: 'git push\n' },
    { label: 'git pull',     value: 'git pull\n' },
    { label: 'git checkout', value: 'git checkout -b ' },
    { label: 'git diff',     value: 'git diff\n' }
  ]},
  HMS: { name: 'Hermes Agent - HMS', items: [
    { label: '/status', value: '/status\n' },
    { label: '/reset',  value: '/reset\n' },
    { label: '/tools',  value: '/tools\n' },
    { label: '/logs',   value: '/logs\n' },
    { label: '/cancel', value: '/cancel\n' },
    { label: '/config', value: '/config ' },
    { label: '/memory', value: '/memory ' },
    { label: '/mcp',    value: '/mcp ' }
  ]},
  KEY: { name: 'Keyboard Shortcuts - KEY', items: [
    { label: '▲',           value: '\x1b[A' },
    { label: '▼',           value: '\x1b[B' },
    { label: '◀',           value: '\x1b[D' },
    { label: '▶',           value: '\x1b[C' },
    { label: 'PgUp',        value: '\x1b[5~' },
    { label: 'PgDn',        value: '\x1b[6~' },
    { label: 'Home',        value: '\x1b[H' },
    { label: 'End',         value: '\x1b[F' },
    { label: '|',   value: '|' },
    { label: '~',   value: '~' },
    { label: '>',   value: '>' },
    { label: '>>',  value: '>>' },
    { label: '<',   value: '<' },
    { label: '&&',  value: '&& ' },
    { label: '||',  value: '|| ' },
    { label: ';',   value: '; ' },
    { label: '`',   value: '`' },
    { label: '\\',  value: '\\' },
    { label: '/',   value: '/' },
    { label: '$',   value: '$' },
    { label: '#',   value: '#' },
    { label: 'ESC', value: '\x1b' },
    { label: 'TAB', value: '\t' },
    { label: 'DEL', value: '\x1b[3~' },
    { label: '^C',  value: '\x03' },
    { label: '^Z',  value: '\x1a' },
    { label: '^D',  value: '\x04' },
    { label: '^A',  value: '\x01' },
    { label: '^E',  value: '\x05' },
    { label: '^K',  value: '\x0b' },
    { label: '^U',  value: '\x15' },
    { label: '^W',  value: '\x17' },
    { label: '^Y',  value: '\x19' },
    { label: '^R',  value: '\x12' },
    { label: '^L',  value: '\x0c' }
  ]},
  NAV: { name: 'Navigation & Arrows - NAV', items: [
    { label: '▲',          value: '\x1b[A' },
    { label: '▼',          value: '\x1b[B' },
    { label: '◀',          value: '\x1b[D' },
    { label: '▶',          value: '\x1b[C' },
    { label: 'PgUp',       value: '\x1b[5~' },
    { label: 'PgDn',       value: '\x1b[6~' },
    { label: 'Home',       value: '\x1b[H' },
    { label: 'End',        value: '\x1b[F' },
    { label: 'Ctrl+Left',  value: '\x1b[1;5D' },
    { label: 'Ctrl+Right', value: '\x1b[1;5C' },
    { label: 'Shift+Tab',  value: '\x1b[Z' },
    { label: 'Backspace',  value: '\x7f' },
    { label: 'Enter',      value: '\r' },
    { label: 'F1',         value: '\x1bOP' },
    { label: 'F2',         value: '\x1bOQ' },
    { label: 'F3',         value: '\x1bOR' },
    { label: 'F4',         value: '\x1bOS' },
    { label: 'F5',         value: '\x1b[15~' },
    { label: 'F6',         value: '\x1b[17~' },
    { label: 'F7',         value: '\x1b[18~' },
    { label: 'F8',         value: '\x1b[19~' },
    { label: 'F9',         value: '\x1b[20~' },
    { label: 'F10',        value: '\x1b[21~' },
    { label: 'F11',        value: '\x1b[23~' },
    { label: 'F12',        value: '\x1b[24~' }
  ]},
  NET: { name: 'Networking Tools - NET', items: [
    { label: 'ip a',       value: 'ip a\n' },
    { label: 'ping',       value: 'ping -c 4 ' },
    { label: 'netstat',    value: 'sudo netstat -tuln\n' },
    { label: 'ss -tulpn',  value: 'sudo ss -tulpn\n' },
    { label: 'ufw status', value: 'sudo ufw status\n' },
    { label: 'curl -I',    value: 'curl -I ' },
    { label: 'dig',        value: 'dig ' },
    { label: 'traceroute', value: 'traceroute ' }
  ]},
  NPM: { name: 'Web Dev & Node - NPM', items: [
    { label: 'npm install', value: 'npm install\n' },
    { label: 'npm run dev', value: 'npm run dev\n' },
    { label: 'npm run build', value: 'npm run build\n' },
    { label: 'npx', value: 'npx ' },
    { label: 'yarn add', value: 'yarn add ' },
    { label: 'node -v', value: 'node -v\n' }
  ]},
  PAC: { name: 'Arch Pacman - PAC', items: [
    { label: 'upgrade -y',    value: 'sudo pacman -Syu\n' },
    { label: 'pacman install', value: 'sudo pacman -S ' },
    { label: 'pacman search',  value: 'pacman -Ss ' },
    { label: 'pacman remove',  value: 'sudo pacman -Rns ' },
    { label: 'pacman clean',   value: 'sudo pacman -Sc\n' },
    { label: 'pacman list',    value: 'pacman -Qe\n' }
  ]},
  PY: { name: 'Python & Venv - PY', items: [
    { label: 'python3',      value: 'python3 ' },
    { label: 'pip install',  value: 'pip install ' },
    { label: 'venv create',  value: 'python3 -m venv venv\n' },
    { label: 'venv activate', value: 'source venv/bin/activate\n' },
    { label: 'pip list',     value: 'pip list\n' },
    { label: 'pip freeze',   value: 'pip freeze > requirements.txt\n' }
  ]},
  SYS: { name: 'System Admin - SYS', items: [
    { label: 'systemctl',  value: 'sudo systemctl status ' },
    { label: 'restart srv', value: 'sudo systemctl restart ' },
    { label: 'journalctl', value: 'sudo journalctl -xeu ' },
    { label: 'lsblk',     value: 'lsblk\n' },
    { label: 'blkid',     value: 'sudo blkid\n' },
    { label: 'df -h',     value: 'df -h\n' },
    { label: 'du -sh *',  value: 'du -sh *\n' },
    { label: 'fdisk -l',  value: 'sudo fdisk -l\n' },
    { label: 'dmesg -T',  value: 'sudo dmesg -T\n' },
    { label: 'htop',      value: 'htop\n' },
    { label: 'free -h',   value: 'free -h\n' },
    { label: 'top',       value: 'top\n' },
    { label: 'uptime',    value: 'uptime\n' }
  ]},
  TMX: { name: 'Tmux Manager - TMX', items: [
    { label: 'tmux ls',     value: 'tmux ls\n' },
    { label: 'tmux new',    value: 'tmux new-session -s ' },
    { label: 'tmux attach', value: 'tmux attach -t ' },
    { label: 'tmux kill',   value: 'tmux kill-session -t ' },
    { label: 'split h',     value: '\x02%' },
    { label: 'split v',     value: '\x02"' }
  ]},
  TXT: { name: 'Search & Parse - TXT', items: [
    { label: 'grep -rnw',  value: 'grep -rnw . -e "' },
    { label: 'find name',  value: 'find . -type f -name "' },
    { label: 'tail -f',    value: 'tail -f ' },
    { label: 'watch',      value: 'watch -n 2 ' },
    { label: 'cat',        value: 'cat ' },
    { label: 'head',       value: 'head -n 20 ' },
    { label: 'nano',       value: 'nano ' }
  ]},
  YUM: { name: 'Fedora/RHEL DNF - YUM', items: [
    { label: 'upgrade -y', value: 'sudo dnf upgrade --refresh -y\n' },
    { label: 'dnf update',  value: 'sudo dnf update\n' },
    { label: 'dnf install', value: 'sudo dnf install ' },
    { label: 'dnf search',  value: 'dnf search ' },
    { label: 'dnf remove',  value: 'sudo dnf remove ' },
    { label: 'autoremove',  value: 'sudo dnf autoremove\n' },
    { label: 'dnf clean',   value: 'sudo dnf clean all\n' }
  ]}
};
