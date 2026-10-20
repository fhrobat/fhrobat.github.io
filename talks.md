---
layout: page
title: Talks and visits
custom_js:
  - theme
  - bibtex
---

{% assign talks = site.data.menu.entries | where: "id", "talks" | first %}
{{ talks.content }}
