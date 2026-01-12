---
layout: page
title: Extra activities and awards
custom_js: theme
---

{% assign extra = site.data.menu.entries | where: "id", "extra" | first %}
{{ extra.content }}
