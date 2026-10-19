# Релизы Meetly

[release-please](https://github.com/googleapis/release-please) после push в `main`
собирает Conventional Commits и создаёт или обновляет release-PR с предложенной
версией и changelog. Обычные PR не меняют версии вручную. Release-PR сливает
человек только по отдельному запросу; его слияние позволяет workflow
опубликовать GitHub Release и тег.

## Конфигурация после переноса репозитория

- Репозиторий и `package-name`: `StepanovCode/ai-for-developers-project-387`
  и `ai-for-developers-project-387` соответственно.
- `release-type: simple` обновляет корневой `version.txt`; release-please
  также ведёт `.release-please-manifest.json` и общий `CHANGELOG.md`.
- `bootstrap-sha: a5d8c6ade5201fc2cc19f97296878a82b40606ed` — коммит
  импорта Meetly в проект 387. Он служит исключающей границей для первого
  changelog: учитываются последующие коммиты этого проекта, а импорт и
  предыдущая история Хекслета не переписываются.
- `version.txt` и manifest пока содержат `0.0.0`. Следующую версию определяет
  release-please по конфигурации и накопленным коммитам; вручную её не задаём.
- После первого слитого release-PR `bootstrap-sha` больше не определяет
  границу: release-please использует сведения о предыдущем релизе.

Семантика границы и начальной версии описана в
[документации manifest releaser](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#bootstrapping).

## Подготовка токена

Workflow использует repository secret `RELEASE_PLEASE_TOKEN`. Встроенный
`GITHUB_TOKEN` не подходит для этого сценария: созданный им release-PR
не запускает обычные workflow на новых событиях. Здесь нужны CI и авторевью
на release-PR, поэтому оставляем отдельный токен.

Владелец создаёт fine-grained personal access token с доступом только к
`StepanovCode/ai-for-developers-project-387` и правами Contents, Issues,
Pull requests — Read and write. В Settings → Secrets and variables → Actions
нужно добавить его как repository secret `RELEASE_PLEASE_TOKEN`.
Значение токена не записывайте в Git, issue, PR или логи.

Обоснование отдельного токена и необходимые права:
[release-please-action](https://github.com/googleapis/release-please-action#token).
Если токен отсутствует, шаг `Require token that triggers CI on release PRs`
останавливает workflow до запуска release-please с явным сообщением.

## Проверка

1. До слияния проверьте workflow командой `make workflows-check` в Docker.
   Проверьте, что `bootstrap-sha` существует в истории `main`, а версия
   в manifest совпадает с `version.txt`.
2. После добавления секрета и разрешённого слияния откройте Actions →
   `release-please`. Проверьте успешный запуск на push в `main`.
   Для повторной проверки можно вручную запустить workflow на `main`;
   этот запуск может создать или обновить release-PR и GitHub Release.
3. Найдите release-PR в этот репозиторий: заголовок соответствует
   Conventional Commits, изменения включают версию, manifest и changelog,
   ссылки ведут на коммиты проекта 387 после границы импорта.
4. Проверьте CI и `OpenCode PR Review` на release-PR. До отдельного решения
   о выпуске оставьте его открытым.

Синтаксическая проверка и чтение конфигурации не подтверждают интеграцию.
Для подтверждения нужны успешный запуск Actions и фактический release-PR.
