# Оттиск

Браузерная головоломка BLUE с мягким чернильным персонажем.

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

Минутное вступление моделируется и анимируется вручную в Blender 5.3. Сцена хранится в `ottisk/exports/opening-scene.blend`. Для рендера используется Cycles с OptiX.

```sh
python ottisk/tools/render_intro60.py --assets
blender --background --python ottisk/tools/blender_opening.py -- --render
python ottisk/tools/assemble_opening.py
```
