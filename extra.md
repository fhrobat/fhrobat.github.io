---
layout: page
title: Extra activities and awards
description: Scholarships, prizes, schools and roles of Francesco Hrobat.
custom_js: theme
---

{% assign extra = site.data.menu.entries | where: "id", "extra" | first %}
{{ extra.content }}
