
'use client';

import React, { useRef, useMemo } from 'react';
import ReactQuill, { ReactQuillProps } from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface QuillEditorProps extends ReactQuillProps {
  forwardedRef?: React.Ref<ReactQuill>;
}

const QuillEditor: React.FC<QuillEditorProps> = ({ forwardedRef, ...props }) => {
  return <ReactQuill ref={forwardedRef} {...props} />;
};


const DynamicQuill = (props: ReactQuillProps) => {
  const quillRef = useRef<ReactQuill>(null);

  const QuillComponent = useMemo(() => {
    return (props: any) => {
        const {forwardedRef, ...rest} = props;
        return <QuillEditor forwardedRef={forwardedRef} {...rest}/>
    }
  }, []);


  return <QuillComponent forwardedRef={quillRef} {...props} />;
};

export default DynamicQuill;
