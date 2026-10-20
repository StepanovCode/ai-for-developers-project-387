# Meetly

[![hexlet-check](https://github.com/StepanovCode/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/StepanovCode/ai-for-developers-project-387/actions/workflows/hexlet-check.yml)

Сервис записи на звонки: выбор свободного времени, бронирование и управление
встречами. Учебный проект Хекслета на React, TypeScript, Go и PostgreSQL.

Текущий репозиторий — [проект 387](https://github.com/StepanovCode/ai-for-developers-project-387).
**[Открыть сайт →](https://ai-for-developers-project-386-al08.onrender.com/)**

Публичный URL приложения для ночной проверки задаётся переменной репозитория
`LIGHTHOUSE_URL`; настройка описана в [инструкции GitHub Actions](.github/workflows/README.md).

## Локальный запуск

Нужны Git, Make и запущенный Docker с Compose v2. Все зависимости работают
в контейнерах.

```bash
git clone https://github.com/StepanovCode/ai-for-developers-project-387.git
cd ai-for-developers-project-387
make start
```

Откройте [localhost:5173](http://localhost:5173). Команда установит зависимости,
применит миграции и запустит приложение; `.env` создавать необязательно.

- `make down` — остановить приложение, сохранив данные.
- `make check` — запустить линтеры, тесты и сборку.

Подробнее: [Frontend](frontend/README.md) · [Backend](backend/README.md) · [API](api/README.md).

## GitHub Actions и агент

| Workflow | Событие | Модель | Назначение | Прогоны |
|---|---|---|---|---|
| [CI](.github/workflows/ci.yml) | `push`, `pull_request` | Не используется | Проверки frontend/backend, БД, коммитов и автоматизации | [Actions: CI](https://github.com/StepanovCode/ai-for-developers-project-387/actions/workflows/ci.yml) |
| [hexlet-check](.github/workflows/hexlet-check.yml) | `push` ветки или тега | Не используется | Учебные проверки Хекслета | [Actions: hexlet-check](https://github.com/StepanovCode/ai-for-developers-project-387/actions/workflows/hexlet-check.yml) |
| [release-please](.github/workflows/release-please.yml) | `push` в `main`, ручной запуск | Не используется | Подготовка release-PR, версии и changelog | [Actions: release-please](https://github.com/StepanovCode/ai-for-developers-project-387/actions/workflows/release-please.yml) |
| [OpenCode](.github/workflows/opencode.yml) | Новый комментарий в issue, PR или diff с `/opencode` или `/oc` от доверенного человека | `opencode/deepseek-v4.1-flash` | Объяснение или изменение по команде участника | [Actions: OpenCode](https://github.com/StepanovCode/ai-for-developers-project-387/actions/workflows/opencode.yml) |
| [OpenCode Issue Triage](.github/workflows/opencode-triage.yml) | Новая issue доверенного человека | `opencode/deepseek-v4.1-flash` | Первичный технический разбор, без исправления кода | [Actions: Triage](https://github.com/StepanovCode/ai-for-developers-project-387/actions/workflows/opencode-triage.yml) |
| [OpenCode PR Review](.github/workflows/opencode-review.yml) | `opened`, `synchronize`, `reopened`, `ready_for_review` PR от инициатора типа `User` | `opencode/deepseek-v4.1-flash` | Ревью публичного PR из ветки репозитория, без изменения кода | [Actions: Review](https://github.com/StepanovCode/ai-for-developers-project-387/actions/workflows/opencode-review.yml) |
| [OpenCode Lighthouse Audit](.github/workflows/opencode-audit.yml) | Ежедневно в 03:17 UTC / 06:17 по Москве; ручной запуск от `User` | `opencode/deepseek-v4.1-flash` | Анализ Lighthouse, создание или обновление issue с находками | [Actions: Audit](https://github.com/StepanovCode/ai-for-developers-project-387/actions/workflows/opencode-audit.yml) |

### Вызов, права и публикация

Команды `/opencode,/oc` заданы явно в `mentions` и в условии job. Обе оставлены
для совместимости: `/opencode` — полная форма, `/oc` — короткая. Только новые
комментарии аккаунтов типа `User` с association `OWNER`, `MEMBER` или `COLLABORATOR` могут
вызвать агента; OpenCode дополнительно проверяет право инициатора `admin` или
`write`. Обычный комментарий, внешний автор, бот или само приложение дают
`skipped` без вызова модели. Редактирование комментария агента не запускает.
Автотриаж использует те же ограничения авторов, но не требует команды.

Авторевью проверяет **инициатора события**, а не автора PR: событие от бота
пропускается, а обновление PR агента человеком может запустить проверку.
PR из форков и приватные репозитории пропускаются. release-please использует
PAT владельца, поэтому его события от аккаунта типа `User` проходят фильтр
и запускают ревью. Тип аккаунта не доказывает, что действие выполнено вручную.
Ночной аудит допускает
запуск по `schedule` без `sender`; ручной запуск требует `sender.type == 'User'` и доступен
участникам с правом запуска Actions. Это исключение для расписания необходимо,
чтобы фильтр ботов не отключил cron.

Права заданы отдельно в каждом workflow:

| Агентный workflow | Права `GITHUB_TOKEN` | Зачем |
|---|---|---|
| OpenCode, Issue Triage | `id-token: write` | OIDC-обмен на токен установленного OpenCode GitHub App |
| PR Review | `contents: read`, `issues: read`, `pull-requests: write`, `id-token: write` | Чтение кода и связанных issue, публикация комментария доверенными API-шагами; CLI без GitHub-токена |
| Lighthouse Audit | `contents: write`, `pull-requests: write`, `issues: write`, `id-token: write` | Явный набор прав по требованиям задания; агент публикует результаты в issue |

Более широкие права аудита и `id-token: write` у ревью выданы для точного
соответствия требованиям задания, а не потому, что все эти права технически
нужны сценарию. В ревью OIDC не используется; аудит сохраняет
`use_github_token: true` и тоже не выполняет OIDC-обмен. Права командного
workflow и триажа остаются отдельными.

Права `GITHUB_TOKEN`, права установленного GitHub App и разрешения инструментов
OpenCode — разные уровни. Малые права токена раннера не сужают права App.
У ревью инструменты ограничены чтением и поиском, токен GitHub не передаётся
CLI; ключ провайдера передаётся в его контейнер. Команды, триаж и аудит используют
стандартного агента `build`. Инструкция ревью явно задана в `with.prompt`
workflow и через обязательный вход локального composite action передаётся
в `make opencode-review`. Этот путь сохраняет чтение без изменений кода,
проверку завершённого сообщения и текущего head перед публикацией: upstream
GitHub Action сам публикует ответ без такой детерминированной проверки head.
Запреты в их промптах описывают задачу, но не заменяют ограничения токена
или [разрешения инструментов](https://opencode.ai/docs/permissions/).
Checkout во всех агентных workflow использует `persist-credentials: false`.

**Решение для публичного репозитория: публикация сессий отключена во всех
четырёх workflow.** Для GitHub Action явно задано `share: false`, для CLI и
конфигурации — `"share": "disabled"`. В issue/PR публикуются только предусмотренные
результаты; полный контекст сессии по отдельной публичной ссылке не раскрывается.
Код и инструкции по-прежнему обрабатывает внешний провайдер модели.

### Выбор модели и расходы

Основная и служебная (`small_model`) модели во всех четырёх workflow —
`opencode/deepseek-v4.1-flash`. Доступность этой модели ключу курса подтверждена
реальным запуском; одинаковая `small_model` исключает автоматический выбор
недоступной служебной модели. Дорогая модель для каждого события не назначается;
переход на другую модель требует конкретной задачи и проверки доступа/стоимости.

Вход `agent` у GitHub Action не переопределён: используется стандартный `build`
при текущей конфигурации. CLI авторевью явно выбирает отдельного агента `review`
с разрешёнными чтением, поиском и `webfetch`. `variant` не задан: используется
режим провайдера по умолчанию. Уровни вроде `high` или `minimal` нельзя считать
поддержанными для выбранной модели без отдельной проверки.

Каждый разрешённый запуск обращается к провайдеру. Таймауты 20 минут
(аудит — 25), отмена устаревшего ревью и последовательное выполнение аудитов
ограничивают работу, но не задают денежный бюджет. Расходы и лимит ключа смотрят
в [OpenCode Console](https://opencode.ai/console); лимит пространства Хекслета
уточняют у куратора. Подтверждение денежного лимита пока не получено.

### Самооценка работы с агентом

Исторические примеры ниже подтверждают прежние прогоны. Runtime-проверка
новой конфигурации ревью и прав аудита **ещё не выполнена**; после публикации
PR нужны реальные прогоны. Cron на `main` и обновление release-PR после
слияния этих изменений также ожидают проверки.

- **С первого прохода после согласования критериев:** агент подготовил
  [исправление сообщений о недоступном слоте](https://github.com/StepanovCode/ai-for-developers-project-387/pull/12)
  одним коммитом, с регрессионными тестами и проверками frontend/backend.
  Это результат одного вызова реализации, а не всей задачи без участия человека:
  до него были разбор и уточнение критериев. Браузерную проверку агент не выполнил.
- **Первичный разбор:** жалоба
  [«Свободное время внезапно оказывается „уже занято“»](https://github.com/StepanovCode/ai-for-developers-project-387/issues/9#issuecomment-6267194544)
  получила содержательный автотриаж без команды и без исправления приложения.
- **Потребовались итерации:** при
  [подключении OpenCode](https://github.com/StepanovCode/ai-for-developers-project-387/issues/4#issuecomment-6266634609)
  сначала не было доступного секрета, затем провайдер отклонял основную и
  служебную модели. После явного выбора DeepSeek ответ получен за успешный
  прогон (job 35 секунд, шаг агента 28 секунд). При этом агент пересказал
  устаревший статус из обсуждения — актуальный результат пришлось сверить человеку.
- **Ревью улучшило автоматизацию:** в
  [PR авторевью](https://github.com/StepanovCode/ai-for-developers-project-387/pull/10)
  после замечаний доработаны изоляция конфигурации, права токена и проверка
  завершения именно публикуемого сообщения. Конфигурация и зелёный actionlint
  сами по себе не подтвердили интеграцию: потребовались реальные прогоны.
- **Исправление отдельным коммитом после обсуждения:**
  [PR «fix(web): cache versioned frontend assets»](https://github.com/StepanovCode/ai-for-developers-project-387/pull/19)
  закрывает [задачу кэширования frontend](https://github.com/StepanovCode/ai-for-developers-project-387/issues/18).
  До исправления опубликованы [общее ревью](https://github.com/StepanovCode/ai-for-developers-project-387/pull/19#pullrequestreview-5586109828)
  (тело review, а не отдельный issue-comment) и
  [команда `/oc` в diff](https://github.com/StepanovCode/ai-for-developers-project-387/pull/19#discussion_r4325835032).
  Агент добавил [отдельный коммит](https://github.com/StepanovCode/ai-for-developers-project-387/pull/19/commits/1108e57258d96eb37d8012db20b7c8696145b655).
  [Первый прогон](https://github.com/StepanovCode/ai-for-developers-project-387/actions/runs/39435288697)
  успел отправить коммит, но был отменён после таймаута на запросе
  `external_directory` для конфигурации авторизации `gh`.
  [Успешный повторный прогон](https://github.com/StepanovCode/ai-for-developers-project-387/actions/runs/39438456562)
  подготовил только итоговый текст.
- **Проверяемые результаты автоматизации:** успешное
  [авторевью с замечаниями](https://github.com/StepanovCode/ai-for-developers-project-387/pull/17#issuecomment-6272592143)
  связано с [прогоном `pull_request`](https://github.com/StepanovCode/ai-for-developers-project-387/actions/runs/39288688525).
  Настоящий [ночной прогон `schedule`](https://github.com/StepanovCode/ai-for-developers-project-387/actions/runs/39394621089)
  сохранил артефакты и опубликовал [отчёт с находкой кэширования](https://github.com/StepanovCode/ai-for-developers-project-387/issues/15),
  из которой получилась задача исправления выше. После слияния исправления
  [release-please](https://github.com/StepanovCode/ai-for-developers-project-387/actions/runs/39446775367)
  создал [release-PR 0.1.1](https://github.com/StepanovCode/ai-for-developers-project-387/pull/20).
  Это подтверждает создание PR, а не публикацию релиза; повторный Lighthouse
  после исправления кэша и проверка деплоя не выполнялись.

Подключение, артефакты аудита, инструкции проверки и ограничения описаны в
[инструкции GitHub Actions](.github/workflows/README.md). Локальные проверки:
`make tooling-build tooling-install`, затем `make workflows-check
review-report-test lighthouse-audit-test`. Они выполняются в Docker; условия
запуска, разрешения и публикацию проверяем вручную в GitHub Actions.
