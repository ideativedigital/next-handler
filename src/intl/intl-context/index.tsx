import { useTranslations } from "next-intl"
import { createRef, useEffect } from "react"


export type IntlContextType = {
    locale: string
    translator: ReturnType<typeof useTranslations> | undefined
}


export type BaseTranslateFn = ReturnType<typeof useTranslations>

const translateRef = createRef<BaseTranslateFn>()


function throwIfUndefined() {
    if (!translateRef.current) {
        throw new Error(
            'Translations not loaded, please use the <CaptureTranslator /> component to capture the translator'
        )
    }
}

export const globalTranslate: BaseTranslateFn = Object.assign(
    (...args: Parameters<BaseTranslateFn>) => {
        throwIfUndefined()
        return (translateRef as any).current(...args)
    },
    {
        rich: (...args: Parameters<BaseTranslateFn['rich']>) => {
            throwIfUndefined()
            return (translateRef as any).current.rich(...args)
        },
        markup: (...args: Parameters<BaseTranslateFn['markup']>) => {
            throwIfUndefined()
            return (translateRef as any).current.markup(...args)
        },
        raw: (...args: Parameters<BaseTranslateFn['raw']>) => {
            throwIfUndefined()
            return (translateRef as any).current.raw(...args)
        },
        has: (...args: Parameters<BaseTranslateFn['has']>) => {
            throwIfUndefined()
            return (translateRef as any).current.has(...args)
        }
    }
)

export const CaptureTranslator = () => {
    const translator = useTranslations()
    useEffect(() => {
        translateRef.current = translator
    }, [translator])

    return null
}