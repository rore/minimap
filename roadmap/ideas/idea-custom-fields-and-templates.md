---
id: idea-custom-fields-and-templates
title: Custom fields and templates
status: queued
priority: low
commitment: uncommitted
labels:
  - schema
  - templates
---

## Summary

Allow repos to extend the basic roadmap item shape with custom fields or starter templates.

## Why

Different repos may want more structure, but that flexibility should not complicate the default product too early.

## In Scope

- optional extra item templates
- configurable defaults for new items
- potential support for repo-specific metadata fields

## Out of Scope

- schema builders with their own persistence layer
- highly dynamic UI generation for v1
- abandoning the simple canonical default shape

## Done When

- a repo can tailor item creation without breaking the default contract

## Notes

This should wait until the fixed default flow is proven useful.
