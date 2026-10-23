---
layout: page
title: Talks
description: Talks and posters by Francesco Hrobat, with slides.
custom_js:
  - theme
  - bibtex
---

{% assign talks = site.data.menu.entries | where: "id", "talks" | first %}
{{ talks.content }}
