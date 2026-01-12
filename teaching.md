---
layout: page
title: Teaching
custom_js: theme
---

{% assign teaching = site.data.menu.entries | find: "id", "teaching" | first %}
{{ teaching.content }}
