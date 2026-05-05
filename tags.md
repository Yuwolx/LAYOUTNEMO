---
layout: default
title: Tags
permalink: /tags/
---

# 태그

블럭 단위로 태그된 글들을 한눈에 봅니다.

{% assign all_pages = site.pages | where_exp: "p", "p.tags" %}
{% assign all_tags = "" | split: "" %}
{% for p in all_pages %}
  {% for t in p.tags %}
    {% assign all_tags = all_tags | push: t %}
  {% endfor %}
{% endfor %}
{% assign uniq_tags = all_tags | uniq | sort %}

<div class="tags-cloud">
{% for t in uniq_tags %}
  {% assign count = all_tags | where_exp: "x", "x == t" | size %}
  <a href="#{{ t }}" class="tag-chip">#{{ t }} <span class="tag-chip__count">{{ count }}</span></a>
{% endfor %}
</div>

{% for t in uniq_tags %}
<h2 id="{{ t }}">#{{ t }}</h2>
<ul class="recent-posts">
  {% assign tagged = site.pages | where_exp: "p", "p.tags" | where_exp: "p", "p.tags contains t" | sort: "name" | reverse %}
  {% for p in tagged %}
    {% assign date_part = p.name | slice: 0, 10 %}
    <li class="recent-posts__item">
      <span class="recent-posts__date">{{ date_part }}</span>
      <a class="recent-posts__link" href="{{ p.url | relative_url }}">{{ p.title }}</a>
    </li>
  {% endfor %}
</ul>
{% endfor %}

{% if uniq_tags.size == 0 %}
_아직 태그된 글이 없습니다._ 글 front matter 에 `tags: [태그1, 태그2]` 추가하면 여기에 자동 노출됩니다.
{% endif %}
