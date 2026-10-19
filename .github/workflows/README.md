# Automatic tests

After completing all the steps in the project, automatic tests will become available to you. Tests are run on each commit - once all tasks in the Hexlet interface are completed, make a commit, and the tests will run automatically.

The hexlet-check.yml file is responsible for running these tests - do not delete this file, edit it, or rename the repository.

## OpenCode

Агент запускается в GitHub Actions независимо от локального Codex.
Обработчик команд находится в [opencode.yml](opencode.yml), автоматический
разбор новых issue — в [opencode-triage.yml](opencode-triage.yml).

### Подключение

1. Установите [OpenCode GitHub App](https://github.com/apps/opencode-agent)
   на репозиторий `StepanovCode/ai-for-developers-project-387`.
2. Получите у куратора Хекслета ключ для GitHub Actions из пространства
   Hexlet Students. Добавьте его в Settings → Secrets and variables → Actions
   как repository secret `OPENCODE_API_KEY`. Ключ не записывайте в файлы проекта.
3. Проверьте лимит расходов ключа у куратора; бюджет пространства и расход
   доступны в [OpenCode Console](https://opencode.ai/console).
4. Слейте workflow в `main`: обработчик комментариев должен находиться
   в основной ветке, прежде чем отправлять команду.

Подробности о ключе и лимитах: [инструкция Хекслета](https://help.hexlet.io/ai/opencode).

### Как устроен workflow

- `issue_comment` обрабатывает комментарии в issue и обсуждении pull request;
  `pull_request_review_comment` — комментарии к строкам diff.
  Оба события ограничены `types: [created]`: правка комментария не запускает агента.
- Условие `if` пропускает работу только для комментариев людей с ролью
  `OWNER`, `MEMBER` или `COLLABORATOR`, содержащих `/opencode` либо `/oc`.
  Обычный комментарий создаёт пропущенный job без вызова модели.
- `mentions: /opencode,/oc` задаёт агенту тот же набор команд.
- Единственное право токена workflow — `id-token: write`. Через OIDC OpenCode
  получает токен установленного GitHub App и выполняет GitHub-операции его правами.
  `persist-credentials: false` запрещает checkout сохранять токен раннера в Git.
- `model: opencode/deepseek-v4.1-flash` выбирает DeepSeek V4.1 Flash через
  провайдера OpenCode. Ключ берётся из секрета `OPENCODE_API_KEY`.
  Через `OPENCODE_CONFIG_CONTENT` параметр `small_model` задаёт ту же модель
  для служебных задач, включая генерацию заголовков сессий. Это исключает
  автоматический выбор другой модели, которая может быть недоступна ключу курса.
  Если ключу курса недоступна модель, уточните доступные модели у куратора
  и обновите `model`, `small_model` и это описание.
  Выбран идентификатор без суффикса `-free`; доступ и стоимость определяются
  провайдером и настройками ключа.
- При отсутствии ключа шаг `Require OpenCode API key` завершает job с понятной
  ошибкой. Лимит времени job — 20 минут; это не заменяет лимит расходов провайдера.

### Проверка подключения

В [проверочном issue](https://github.com/StepanovCode/ai-for-developers-project-387/issues/4)
оставьте отдельный новый комментарий от своего аккаунта:

```text
/oc explain this issue
```

Дождитесь ответа OpenCode. Во вкладке Actions откройте workflow OpenCode,
найдите прогон с событием `issue_comment` и проверьте результат шага
`Run OpenCode`. Сохраните в issue ссылку на прогон, его длительность
и краткий результат. Проверка считается завершённой только при наличии
ответа агента и успешного прогона.

Локальная проверка синтаксиса всех поддерживаемых workflow: `make workflows-check`
(actionlint в Docker). Она не проверяет установку приложения, ключ и доступ к модели.

### Автоматический разбор новых issue

Workflow `OpenCode Issue Triage` запускается на `issues: opened` для issue,
созданных людьми. Комментарий с командой не нужен: инструкция находится
в обязательном для этого события `prompt`. Агент читает жалобу и код,
публикует один комментарий с вероятной причиной, затронутыми файлами,
путём исправления и критериями приёмки. Он должен отделять факты от гипотез.
Этот запуск предназначен только для разбора, без изменения приложения.

Используются те же GitHub App, OIDC, секрет, основная и служебная модели,
что и для команд. Каждый запуск обращается к провайдеру модели.
Правка, переоткрытие issue и ответы агента повторный автотриаж не запускают;
issue от ботов пропускаются. Ручные команды продолжают работать отдельно.

Для проверки сначала слейте workflow в `main`, затем создайте новую issue
с жалобой без готового решения и без комментария-команды. Найдите прогон
`OpenCode Issue Triage` с событием `issues`; проверьте успешный шаг
`Triage issue with OpenCode` и содержательный комментарий агента.
Успешный actionlint без этого запуска не подтверждает интеграцию.
Для сравнения с ручным вызовом используйте одинаковый исходный текст жалобы
и учитывайте отличия инструкций в комментарии и в `prompt`.

Справка: [OpenCode в GitHub](https://opencode.ai/docs/github/).
