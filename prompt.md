You are a senior backend engineer.

I want to build a small web service called **moim-tailboard**.

This service replaces Telegram “name tailing” participation messages used in church or group communities. The goal is to make participation management easier.

Target group size: about 100~200 people.

The system should support multiple groups (multi-tenant) such as different regional communities.

Example:
- Incheon Youth College
- Seoul Youth College

Each tenant should have isolated data.

Tech stack preference:
- Node.js
- Express
- MySQL
- Prisma ORM
- Simple server-rendered frontend (EJS)
- Docker support

The project should be structured cleanly for a small service but still maintainable.

--------------------------------------------------

Core problem to solve

Currently people participate in events using Telegram messages like:

💧 Water sales (2 people needed)
- 3/08 Yuna
- 3/15 Yeoul

🔥 Conference participation
Meal O:
- name1
- name2

Meal X:
- name3
- name4

Problems:
1. Messages become too long
2. Hard to see who joined
3. Hard to manage cancellations
4. Difficult to count participants

The service should provide a simple webpage where people can sign up for events.

--------------------------------------------------

Key Functional Requirements

1. Multi-tenant system
Each group is a tenant.

Example tenants:
- incheon
- seoul

URL format:

/t/{tenant_slug}/events
/t/{tenant_slug}/events/{eventId}

--------------------------------------------------

2. Event system

Admins can create events.

Example:
"3/7 Incheon Conference"
"3/22 Music Concert"

Event fields:
- title
- description
- event_date
- is_active

--------------------------------------------------

3. Option Groups

Each event can contain multiple option groups.

Examples:

Meal
Transport
Voice Part
Staff

Option group settings:

- name
- multiple_select (boolean)
- sort_order

--------------------------------------------------

4. Options

Each option group contains selectable options.

Examples:

Meal
- Meal O
- Meal X

Transport
- Use Car
- Self Driving

Choir
- Soprano
- Alto
- Tenor
- Bass

Option settings:

- name
- limit_enabled (boolean)
- limit_count (optional)
- sort_order

Example:

Staff (limit 10 people)

--------------------------------------------------

5. Participants

Participants can join events.

Important rules:

- Anyone can add a name
- Telegram ID is recorded internally
- Name does NOT need to match Telegram name
- Users may register other people

Fields:

- name
- student_no (optional)
- telegram_id
- canceled (boolean)

--------------------------------------------------

6. Duplicate name handling

If the same name already exists in an event,
the UI should prompt the user to add a student number.

Example:

Jo Ara (11)

So:

name = "Jo Ara"
student_no = "11"

--------------------------------------------------

7. Participant Options

Participants select options within groups.

Example:

Participant: Kim Jinhyuk

Meal: Meal O
Transport: Self Driving

--------------------------------------------------

8. Cancel participation

Users can cancel participation.

Instead of deleting rows:

canceled = true

--------------------------------------------------

9. Admin system

Admins are identified by Telegram ID.

Admins can:

- create events
- edit events
- delete events
- manage option groups
- manage options

--------------------------------------------------

10. Logging

All important actions should be logged.

Example logs:

JOIN_EVENT
CANCEL_EVENT
ADMIN_CREATE_EVENT

--------------------------------------------------

Database Schema

Tables:

tenant
admin
event
option_group
option_item
participant
participant_option
action_log

Use MySQL and Prisma schema.

--------------------------------------------------

Expected Output

Please generate:

1. Clean project folder structure

example:

moim-tailboard
 ├ backend
 ├ frontend
 ├ prisma
 ├ docker
 ├ bot (optional telegram bot later)

2. Prisma schema for all tables

3. Express server setup

4. Basic API routes

Routes example:

GET /t/:tenant/events
GET /t/:tenant/events/:eventId

POST /participants
POST /participants/cancel

Admin routes:

POST /admin/events
POST /admin/options

5. Simple EJS pages

pages:

- event list
- event detail
- join form
- admin page

6. Docker setup for

- node
- mysql

--------------------------------------------------

Design Goals

Keep the system simple and maintainable.

This is a small community service used by around 100~200 people but designed so that other groups can use it later.

Focus on:

- clean schema
- simple APIs
- readable code
- easy deployment

Generate the initial project structure and code.