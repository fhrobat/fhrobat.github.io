---
layout: page
title: Teaching
description: Teaching by Francesco Hrobat at the University of Oxford.
custom_js: theme
---

{% assign teaching = site.data.menu.entries | where: "id", "teaching" | first %}
{{ teaching.content }}
