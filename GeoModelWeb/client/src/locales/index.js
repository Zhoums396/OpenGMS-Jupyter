import { createI18n } from 'vue-i18n'
import en from './en'
import zh from './zh'

const i18n = createI18n({
    legacy: false,
    locale: 'en', // 默认语言
    fallbackLocale: 'en',
    messages: {
        en,
        zh
    }
})

export default i18n
