# Оттиск

Браузерная головоломка BLUE с мягким чернильным персонажем.

[Полная инструкция для продолжения разработки](docs/continuation-guide.md) содержит актуальные правила, состояние прототипа, сценарий 16 уровней, описание заставки и перенос в облачное окружение.

## Запуск

Откройте `ottisk/dist/index.html` в браузере или запустите статический сервер.

```sh
python -m http.server 8041 --directory ottisk/dist
```

Игра доступна по адресу http://localhost:8041.

Ведите курсор, чтобы перемещаться. Чернила впитываются при касании. Удерживайте левую кнопку мыши или пробел для сброса чернил. R начинает уровень заново.

## Видео

Готовые ролики находятся в `ottisk/exports`, исходники ручной анимации в `ottisk/tools`.

Для рендера установите Python-зависимости.

```sh
python -m pip install pillow numpy imageio-ffmpeg
```

Актуальная заставка длится 90 секунд и моделируется вручную в Blender 5.3. Постановка включает рабочий стол, руку с непрерывной поверхностью, подробный механизм, макропечать, повреждение всего листа и слияние капель без глаз. [Сценарий и инструкция рендера](docs/opening-90s.md).

Сцена хранится в `ottisk/exports/opening-90s.blend`, видео — `ottisk/exports/opening-90s.mp4`. Для рендера используется Cycles с OptiX. Прежняя минутная версия сохранена отдельно.

```sh
python ottisk/tools/opening90_assets.py
blender --background --python ottisk/tools/blender_opening90.py -- --preview
blender --background --python ottisk/tools/render_opening90.py -- --start 1 --end 2160
python ottisk/tools/assemble_opening90.py
```
