import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// --- NEXTAUTH SCHEMAS ---

export const users = sqliteTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
});

export const accounts = sqliteTable('account', {
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (account) => ({
  compoundKey: primaryKey({
    columns: [account.provider, account.providerAccountId],
  }),
}));

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (vt) => ({
  compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
}));

// --- SIGNALERTICA SCHEMAS ---

export const intelligenceLogs = sqliteTable('intelligence_logs', {
  id: text('id').primaryKey(), // Using numeric-like string ID from frontend
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  channel: text('channel').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

export const capturedArticles = sqliteTable('captured_articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  logId: text('log_id').notNull().references(() => intelligenceLogs.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  image: text('image'),
  url: text('url').notNull(),
  source: text('source').notNull(),
  publishedAt: text('published_at').notNull(),
});

export const interests = sqliteTable('interests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  language: text('language'),
  country: text('country'),
  refreshInterval: integer('refresh_interval').default(0),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).default(false),
  lastScanAt: integer('last_scan_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    userNameUnique: uniqueIndex('interests_user_name_unique').on(table.userId, table.name),
  };
});

export const keywords = sqliteTable('keywords', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  interestId: integer('interest_id').notNull().references(() => interests.id, { onDelete: 'cascade' }),
  word: text('word').notNull(),
}, (table) => {
  return {
    interestWordUnique: uniqueIndex('keywords_interest_word_unique').on(table.interestId, table.word),
  };
});

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    endpointUnique: uniqueIndex('push_subscriptions_endpoint_unique').on(table.endpoint),
  };
});

export const systemSettings = sqliteTable('system_settings', {
  id: text('id').primaryKey(), // Using "global" as the id
  isSyncEnabled: integer('is_sync_enabled', { mode: 'boolean' }).notNull().default(true),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- RELATIONS ---

export const usersRelations = relations(users, ({ many }) => ({
  interests: many(interests),
  pushSubscriptions: many(pushSubscriptions),
  intelligenceLogs: many(intelligenceLogs),
}));

export const intelligenceLogsRelations = relations(intelligenceLogs, ({ one, many }) => ({
  user: one(users, {
    fields: [intelligenceLogs.userId],
    references: [users.id],
  }),
  articles: many(capturedArticles),
}));

export const capturedArticlesRelations = relations(capturedArticles, ({ one }) => ({
  log: one(intelligenceLogs, {
    fields: [capturedArticles.logId],
    references: [intelligenceLogs.id],
  }),
}));

export const interestRelations = relations(interests, ({ one, many }) => ({
  user: one(users, {
    fields: [interests.userId],
    references: [users.id],
  }),
  keywords: many(keywords),
}));

export const keywordRelations = relations(keywords, ({ one }) => ({
  interest: one(interests, {
    fields: [keywords.interestId],
    references: [interests.id],
  }),
}));
