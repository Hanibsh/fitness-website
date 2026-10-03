import { createContext, useContext } from 'react'

// Lets a button inside a modal (a Cancel, say) close it the same way the ✕
// does — fading out first. Modal.jsx provides it. Outside a modal this is
// null; fall back to your own onClose: `const close = useModalClose() ?? onClose`.
export const ModalCloseContext = createContext(null)
export const useModalClose = () => useContext(ModalCloseContext)
