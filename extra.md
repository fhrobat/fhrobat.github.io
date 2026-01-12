---
layout: page
title: Extra activities and awards
custom_js: theme
---

{% assign extra = site.data.menu.entries | find: "id", "extra" | first %}
{{ extra.content}}
