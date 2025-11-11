import os
import shutil

def create_txt_backup(source_dir, output_dir):
    """
    সকল ফোল্ডার থেকে .txt ফরম্যাটের ফাইলগুলি কপি করে নতুন txt ফাইল হিসেবে সেইভ করে
    (.bak এক্সটেনশন এবং new.py ফাইল বাদে)
    
    Args:
        source_dir (str): সোর্স ডিরেক্টরি পাথ
        output_dir (str): আউটপুট ডিরেক্টরি পাথ
    """
    
    # আউটপুট ডিরেক্টরি তৈরি করা (যদি না থাকে)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # সমস্ত ফাইল সংগ্রহ করা
    all_files = []
    
    for root, dirs, files in os.walk(source_dir):
        for file in files:
            file_path = os.path.join(root, file)
            all_files.append(file_path)
    
    # ফাইল ফিল্টার করা
    filtered_files = []
    
    for file_path in all_files:
        filename = os.path.basename(file_path)
        
        # শর্ত: .bak এক্সটেনশন বাদে, new.py নাম বাদে
        if not filename.endswith('.bak') and filename != 'deploy_script.py' and filename != 'new.py':
            filtered_files.append(file_path)
    
    # নতুন txt ফাইল তৈরি করা
    output_file = os.path.join(output_dir, "all_files_content.txt")
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        for i, file_path in enumerate(filtered_files):
            try:
                # মূল ফাইল পড়া
                with open(file_path, 'r', encoding='utf-8') as infile:
                    content = infile.read()
                
                # ফাইল হেডার লিখা
                outfile.write(f"=== FILE: {file_path} ===\n")
                outfile.write(content)
                
                # 10 লাইন দূরত্ব (10টি নতুন লাইন)
                if i < len(filtered_files) - 1:  # শেষ ফাইলের পরে না
                    outfile.write("\n" * 10)
                
                print(f"Processed: {file_path}")
                
            except Exception as e:
                print(f"Error processing {file_path}: {str(e)}")
                # এরর হলে শুধু ফাইল নাম লিখে পরের ফাইলে যাওয়া
                outfile.write(f"=== FILE: {file_path} ===\n")
                outfile.write(f"[Error reading file: {str(e)}]\n")
                if i < len(filtered_files) - 1:
                    outfile.write("\n" * 10)
    
    print(f"\nAll files have been combined into: {output_file}")
    return output_file

def main():
    """
    মেইন ফাংশন - ইউজার ইনপুট নিয়ে ফাইল ম্যানেজার চালায়
    """
    print("=== Python File Manager ===")
    print("এই প্রোগ্রাম সকল ফোল্ডার থেকে ফাইলগুলি সংগ্রহ করে একটি txt ফাইলে সংরক্ষণ করবে")
    print("(.bak এক্সটেনশন এবং new.py ফাইল বাদে)\n")
    
    # সোর্স ডিরেক্টরি ইনপুট
    source_dir = input("সোর্স ডিরেক্টরি পাথ দিন (বর্তমান ডিরেক্টরির জন্য Enter চাপুন): ").strip()
    if not source_dir:
        source_dir = os.getcwd()
    
    # আউটপুট ডিরেক্টরি ইনপুট
    output_dir = input("আউটপুট ডিরেক্টরি পাথ দিন (বর্তমান ডিরেক্টরির জন্য Enter চাপুন): ").strip()
    if not output_dir:
        output_dir = os.getcwd()
    
    # পাথ ভ্যালিডেশন
    if not os.path.exists(source_dir):
        print(f"ত্রুটি: সোর্স ডিরেক্টরি '{source_dir}'存在 করে না!")
        return
    
    # প্রক্রিয়া শুরু
    print(f"\nপ্রক্রিয়া শুরু হচ্ছে...")
    print(f"সোর্স: {source_dir}")
    print(f"আউটপুট: {output_dir}")
    
    try:
        result_file = create_txt_backup(source_dir, output_dir)
        print(f"\n✅ সফলভাবে সম্পন্ন হয়েছে!")
        print(f"আউটপুট ফাইল: {result_file}")
        
        # ফাইল সাইজ দেখানো
        file_size = os.path.getsize(result_file)
        print(f"আউটপুট ফাইলের সাইজ: {file_size} bytes")
        
    except Exception as e:
        print(f"❌ ত্রুটি ঘটেছে: {str(e)}")

# বিকল্প: সরাসরি ডিরেক্টরি সেট করে চালানোর জন্য
def quick_run():
    """
    দ্রুত টেস্ট করার জন্য - সরাসরি ডিরেক্টরি সেট করে
    """
    source_dir = os.getcwd()  # বর্তমান ডিরেক্টরি
    output_dir = os.getcwd()  # বর্তমান ডিরেক্টরি
    
    print("দ্রুত মোড চালু...")
    result_file = create_txt_backup(source_dir, output_dir)
    print(f"সম্পন্ন! আউটপুট: {result_file}")

if __name__ == "__main__":
    # ইউজার ইনপুট নিয়ে চালাতে চাইলে:
    main()
    
    # অথবা দ্রুত চালাতে চাইলে:
    # quick_run()