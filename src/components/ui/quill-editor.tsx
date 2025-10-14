
'use client';

import { useEffect, useRef, useState } from 'react';
import type Quill from 'quill';
import 'react-quill/dist/quill.snow.css';

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme?: string;
  className?: string;
}

const QuillEditor: React.FC<QuillEditorProps> = ({
  value,
  onChange,
  theme = 'snow',
  className
}) => {
  const [isClient, setIsClient] = useState(false);
  const quillRef = useRef<Quill | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Dynamically import Quill only on the client side
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined' && editorRef.current) {
      import('quill').then(QuillModule => {
        const Quill = QuillModule.default;
        if (editorRef.current && !quillRef.current) {
          quillRef.current = new Quill(editorRef.current, {
            theme,
            modules: {
              toolbar: [
                [{ header: [1, 2, 3, 4, 5, 6, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'image'],
                ['clean']
              ],
            },
          });

          quillRef.current.on('text-change', () => {
            if (quillRef.current) {
              onChange(quillRef.current.root.innerHTML);
            }
          });
        }
      });
    }
    
    return () => {
        if (quillRef.current) {
            quillRef.current = null;
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Set initial content
  useEffect(() => {
    if (quillRef.current && value !== quillRef.current.root.innerHTML) {
      const delta = quillRef.current.clipboard.convert(value as any);
      quillRef.current.setContents(delta, 'silent');
    }
  }, [value]);

  if (!isClient) {
    return <div>Carregando editor...</div>;
  }

  return <div ref={editorRef} className={className}/>;
};

export default QuillEditor;
