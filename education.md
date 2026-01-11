---
layout: page
title: Education
custom_js: theme
---

{% assign publications = site.data.menu.entries | where: "id", "education" | first %}
{{ education.content }}
