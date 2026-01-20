import { useEffect } from 'react'

const PageTitle = ({ title }) => {
    useEffect(() => {
        document.title = title ? `${title} | Risu` : 'Risu - Gestão de Locações'
    }, [title])

    return null
}

export default PageTitle
