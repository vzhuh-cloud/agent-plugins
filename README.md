# vzhuh.cloud — плагины для агентов

MCP и навыки для публикации **Cloudflare-совместимых Worker-приложений** на vzhuh.cloud. Серверы и данные сайтов — в России; runtime — workerd/Miniflare, постоянные D1 и R2.

- **vzhuh-publish**: возможности платформы, Worker/static, D1/R2, локальная сборка, хеши и upload, preview/production.
- **vzhuh-manage**: доступ по email, версии и откат, данные и логи, квота 64 МиБ.
- OAuth MCP: `https://vzhuh.cloud/mcp`, вход через Яндекс. Сборка выполняется у автора/агента.

## Установка

Штатные команды клиентов и обычный Git. Никакого `curl | sh`, отдельного bootstrap или встроенного установщика.

Нужны установленный клиент и Git. Для Pi — Node.js 22+ и npm; его штатный package manager устанавливает зависимости из package.json. Codex CLI должен поддерживать `codex plugin`, OpenCode — V2, Hermes — OAuth MCP.

### Codex

Штатный Git-marketplace Codex: MCP и оба навыка устанавливаются одним плагином.

```sh
codex plugin marketplace add vzhuh-cloud/agent-plugins --ref v0.3.0
codex plugin add vzhuh@vzhuh-cloud
codex mcp login vzhuh
```

### Claude Code

Штатный GitHub marketplace Claude Code. После установки открой /mcp и авторизуй vzhuh.

```sh
claude plugin marketplace add vzhuh-cloud/agent-plugins
claude plugin install vzhuh@vzhuh-cloud --scope user
```

### Pi

Штатный Pi package из GitHub, закреплённый на теге. После установки в Pi выполни /vzhuh-login.

```sh
pi install git:github.com/vzhuh-cloud/agent-plugins@v0.3.0
```

### OpenCode

Для OpenCode V2. После подключения открой /mcps и авторизуй vzhuh. Git clone, ссылки на навыки и штатная MCP-команда; установочный скрипт не запускается.

```sh
mkdir -p "$HOME/.local/share/vzhuh"
git clone --branch v0.3.0 https://github.com/vzhuh-cloud/agent-plugins.git "$HOME/.local/share/vzhuh/agent-plugins"
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skills"
ln -s "$HOME/.local/share/vzhuh/agent-plugins/skills/vzhuh-publish" "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skills/vzhuh-publish"
ln -s "$HOME/.local/share/vzhuh/agent-plugins/skills/vzhuh-manage" "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skills/vzhuh-manage"
opencode mcp add vzhuh --global --url https://vzhuh.cloud/mcp
```

### Hermes

Для актуального Hermes с OAuth MCP. Если используешь профиль, заранее задай его HERMES_HOME. Git clone, ссылки на навыки и штатная MCP-команда; установочный скрипт не запускается.

```sh
mkdir -p "$HOME/.local/share/vzhuh"
git clone --branch v0.3.0 https://github.com/vzhuh-cloud/agent-plugins.git "$HOME/.local/share/vzhuh/agent-plugins"
mkdir -p "${HERMES_HOME:-$HOME/.hermes}/skills"
ln -s "$HOME/.local/share/vzhuh/agent-plugins/skills/vzhuh-publish" "${HERMES_HOME:-$HOME/.hermes}/skills/vzhuh-publish"
ln -s "$HOME/.local/share/vzhuh/agent-plugins/skills/vzhuh-manage" "${HERMES_HOME:-$HOME/.hermes}/skills/vzhuh-manage"
hermes mcp add vzhuh --url https://vzhuh.cloud/mcp --auth oauth
hermes mcp login vzhuh
```

Если MCP с именем `vzhuh` уже настроен, не добавляй его второй раз: установи только навыки или отключи старую конфигурацию перед установкой нативного плагина. Команды `ln -s` не перезаписывают существующие навыки. Если общий Git checkout уже есть, второй `git clone` не нужен. Перезапусти клиента после установки. OAuth завершает пользователь; пароль Яндекса агенту не передаётся.

### Попробовать

> Используй vzhuh-publish. Собери сайт книжного клуба с регистрацией в D1, опубликуй закрытую версию и покажи ссылку.

В Pi доступны `vzhuh_tools`, `vzhuh_call` и `/vzhuh-login`. Остальные клиенты получают инструменты через штатный MCP. Токены Pi сохраняются в `~/.local/share/vzhuh/pi-auth`; у остальных — в хранилище клиента.

## Возможности и границы

Worker ESM `fetch`, assets, D1 SQLite, R2 objects, независимые production/preview, стабильные HTTPS-адреса, immutable версии, откат кода без удаления данных. Новые сайты закрыты; можно приглашать читателей по основному email Яндекса или сделать сайт публичным.

Это поддержанное подмножество Cloudflare runtime API, **не полная копия Cloudflare REST**. Исходящий fetch Worker, KV, Durable Objects, Queues, Cron, WebSocket, свои домены и платёжные подписки пока не поддерживаются. Закрытые ChatGPT identity/connectors автоматически не переносятся. Размещение сайта в РФ не определяет место обработки кода и запросов твоим ИИ-провайдером.

Подробнее: [runtime и примеры](skills/vzhuh-publish/references/runtime.md), [публикация](skills/vzhuh-publish/references/publish.md), [управление](skills/vzhuh-manage/SKILL.md), [документация](https://vzhuh.cloud/docs/agents).

## Обновление и удаление

Релиз этого пакета — `v0.3.0`. Pi закреплён на теге; для нового релиза повтори `pi install` с новым тегом. Codex: добавь marketplace с новым `--ref`, затем обнови установку плагина штатными командами. Claude: `claude plugin marketplace update vzhuh-cloud`, затем `claude plugin update vzhuh@vzhuh-cloud`. Для Git checkout сначала проверь локальные изменения, затем `git fetch --tags` и `git checkout <новый-тег>`.

Удаление: `codex plugin remove vzhuh@vzhuh-cloud`, `claude plugin uninstall vzhuh@vzhuh-cloud`, `pi remove git:github.com/vzhuh-cloud/agent-plugins@v0.3.0`. Для OpenCode/Hermes отключи MCP штатным способом и удали только две ссылки на навыки. Серверный доступ отзывается в [кабинете](https://vzhuh.cloud/app/connections), сайты и их данные остаются.

Если использовал старый установщик 0.1.0: прежние файлы лежат в `~/.local/share/vzhuh/integrations/0.1.0`. Сначала отключи старое подключение/плагин и убери его ссылки на навыки, затем устанавливай из этого репозитория. Не удаляй весь каталог конфигурации клиента. Пользовательские сайты и данные эта миграция не затрагивает.

## Разработка и проверка

```sh
npm ci --ignore-scripts
npm test
```

Тесты: подготовка бинарных файлов/хешей/chunks и безопасных путей, Pi tool registration/errors, настоящий stdio → HTTP MCP мост через mcp-remote. CI запускает их на Node 22 и 24. Codex marketplace и plugin установлены в изолированном CODEX_HOME; Claude manifests проверены его CLI. Это не утверждение, что живой OAuth проверен во всех пяти клиентах.

[Codex packaging](https://developers.openai.com/plugins/build/plugins) · [Claude plugins](https://code.claude.com/docs/en/plugins-reference) · [OpenCode MCP](https://opencode.ai/docs/mcp-servers/) · [Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp) · [Pi packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).

## Готовые примеры

В `vzhuh-publish` включены исходники и инструкции:

- [Бот лояльности Telegram + MAX](skills/vzhuh-publish/references/webhook-bots.md): D1-журнал, штампы, права бариста, защита от повторных событий и чеков. Для вебхуков и отправки ответов нужен отдельный Docker-сервис; исходящие HTTP-запросы Worker сейчас отключены.
- [Регистрация на мероприятие](skills/vzhuh-publish/references/event-registration.md): адаптивный сайт, форма, D1, атомарный лимит мест и уникальные email. Без отправки писем и проверки email.

Копируй шаблон из `skills/vzhuh-publish/assets/` в свой проект, затем запускай его `build.mjs`. В MCP загружай только полученный `artifact/`. `.env` и токены ботов остаются вне сборки. `npm test` проверяет примеры на Miniflare, конкурентные записи и адаптеры вебхуков; настоящие аккаунты ботов тестам не нужны.
