import { MessageKeys, Messages, NestedKeyOf } from "next-intl";

export type GlobalTranslationKey = MessageKeys<Messages, NestedKeyOf<Messages>>